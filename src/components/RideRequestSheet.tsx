import { useState, useEffect, useRef } from 'react';
import APIClient, { APIUser, APIRide, DriverPublicInfo } from '../lib/api';
import { searchAddresses, formatAddress, GeocodingResult } from '../lib/geocoding';
import { useToast } from './ToastProvider';
import { triggerHaptic } from '../lib/haptics';
import { playNotificationSound, playSuccessSound } from '../lib/audio';
import { PostRideSummary } from './PostRideSummary';

// --- Constants ---
const VEHICLE_RATES: Record<string, { base: number, km: number, min: number }> = { 
  'car': { base: 25, km: 10.0, min: 2.0 }, 
  'taxi': { base: 30, km: 11.0, min: 2.2 }, 
  'rickshaw': { base: 20, km: 8.0, min: 1.5 }, 
  'motorcycle': { base: 22, km: 9.0, min: 1.8 }
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Component ---

interface RideRequestSheetProps {
  session: { user: APIUser } | null;
  initialPlanning?: boolean;
  onPlanningClose?: () => void;
  onPickupChange: (location: [number, number] | null, address?: string) => void;
  onDropoffChange: (location: [number, number] | null, address?: string) => void;
  pickupLocation: [number, number] | null;
  pickupAddress: string;
  dropoffLocation: [number, number] | null;
  dropoffAddress: string;
  stops: { position: [number, number], address: string }[];
  onStopsChange: (stops: { position: [number, number], address: string }[]) => void;
  onStartMapSelection: (type: 'pickup' | 'dropoff' | { type: 'stop', index: number }) => void;
  onRideTypeChange: (type: 'ride' | 'errand' | 'taxi' | 'mototaxi') => void;
  rideType: 'ride' | 'errand' | 'taxi' | 'mototaxi';
  onLoginRequired: (reason?: string) => void;
  preSelectedVehicle?: string;
  onHeaderVisibilityChange: (hide: boolean) => void;
  onActiveRideChange?: (active: boolean) => void;
  /** GPS coords of the device, null if not obtained yet */
  userLocation?: [number, number] | null;
  /** True while waiting for the first GPS fix */
  geoLoading?: boolean;
  /** Callback to fill pickup or dropoff with the device's current location */
  onUseMyLocation?: (field: 'pickup' | 'dropoff') => Promise<void>;
  activeRideOverride?: APIRide;
}

const RadarSearch = () => (
  <div className="radar-view-focused fade-in">
    <div className="radar-container-mini">
      <div className="radar-circle"></div>
      <div className="radar-circle"></div>
      <div className="radar-circle"></div>
      <div className="radar-center-icon">🔍</div>
    </div>
    <div style={{ textAlign: 'center', marginTop: '24px' }}>
      <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '8px' }}>Buscando conductores</h3>
      <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>Conectando con el auto más cercano...</p>
    </div>
  </div>
);

export function RideRequestSheet(props: RideRequestSheetProps) {
  const { 
    session, initialPlanning, onPlanningClose, onPickupChange, onDropoffChange, pickupLocation, pickupAddress, dropoffLocation, dropoffAddress,
    stops, onStopsChange, onStartMapSelection, onRideTypeChange, rideType, onLoginRequired, preSelectedVehicle, onHeaderVisibilityChange, onActiveRideChange,
    userLocation, geoLoading, onUseMyLocation, activeRideOverride
  } = props;

  const { showToast } = useToast();
  const [isPlanning, setIsPlanning] = useState(initialPlanning || false);
  const [focusedInput, setFocusedInput] = useState<'pickup' | 'dropoff' | { type: 'stop', index: number }>('pickup');

  const [suggestions, setSuggestions] = useState<GeocodingResult[]>([]);
  const [searchText, setSearchText] = useState('');
  const [step, setStep] = useState<'service' | 'selection' | 'tracking'>('service');
  const [activeRide, setActiveRide] = useState<APIRide | null>(null);
  const [driverInfo, setDriverInfo] = useState<DriverPublicInfo | null>(null);
  const prevRideStatusRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (activeRide) {
      if (prevRideStatusRef.current !== activeRide.status) {
         if (activeRide.status === 'accepted') {
           playSuccessSound();
           // Fetch real driver info as soon as the ride is accepted
           APIClient.getRideDetails(activeRide.id)
             .then(details => { if (details.driverInfo) setDriverInfo(details.driverInfo); })
             .catch(console.error);
         }
         if (activeRide.status === 'arrived') playNotificationSound();
         if (activeRide.status === 'completed') playSuccessSound();
      }
      prevRideStatusRef.current = activeRide.status;
    } else {
      prevRideStatusRef.current = null;
      setDriverInfo(null);
    }
    onActiveRideChange?.(!!activeRide);
  }, [activeRide, onActiveRideChange]);
  
  const [vehicleType, setVehicleType] = useState<string>(preSelectedVehicle || 'car');
  
  useEffect(() => {
    if (initialPlanning) {
      setIsPlanning(true);
      setFocusedInput('pickup');
    }
  }, [initialPlanning]);

  useEffect(() => {
    if (preSelectedVehicle) setVehicleType(preSelectedVehicle);
  }, [preSelectedVehicle]);

  // Auto-transition to selection when both locations are set
  useEffect(() => {
    if (pickupLocation && dropoffLocation && isPlanning && step !== 'tracking') {
      setIsPlanning(false);
      setStep('selection');
      triggerHaptic('success');
    }
  }, [pickupLocation, dropoffLocation, isPlanning, step]);

  const [loading, setLoading] = useState(false);
  const [errandDescription, setErrandDescription] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (focusedInput === 'pickup' && pickupAddress && !searchText) setSearchText(pickupAddress);
    else if (focusedInput === 'dropoff' && dropoffAddress && !searchText) setSearchText(dropoffAddress);
    else if (typeof focusedInput === 'object' && stops[focusedInput.index]?.address && !searchText) setSearchText(stops[focusedInput.index].address);
  }, [pickupAddress, dropoffAddress, stops]);

  useEffect(() => {
    if (focusedInput === 'pickup') setSearchText(pickupAddress);
    else if (focusedInput === 'dropoff') setSearchText(dropoffAddress);
    else if (typeof focusedInput === 'object') setSearchText(stops[focusedInput.index]?.address || '');
  }, [focusedInput, isPlanning]);

  useEffect(() => {
    if (activeRideOverride) {
      setActiveRide(activeRideOverride);
      setStep('tracking');
    } else if (step === 'tracking' && !activeRideOverride) {
      // Si el servidor ya no devuelve el viaje pero nosotros seguimos en tracking,
      // es muy probable que haya finalizado. Protegemos el estado local.
      if (activeRide && activeRide.status !== 'completed') {
        setActiveRide(prev => prev ? { ...prev, status: 'completed' } : null);
      } else if (!activeRide) {
        setStep('service');
      }
    }
  }, [activeRideOverride, step, activeRide]);

  useEffect(() => {
    onHeaderVisibilityChange(isPlanning || step === 'tracking');
    return () => onHeaderVisibilityChange(false);
  }, [isPlanning, step, onHeaderVisibilityChange]);

  const handleSearch = (text: string) => {
    setSearchText(text);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      const results = await searchAddresses(text);
      setSuggestions(results);
    }, 400);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    }
  }, []);


  const pickupInputRef = useRef<HTMLInputElement>(null);
  const dropoffInputRef = useRef<HTMLInputElement>(null);

  const selectSuggestion = (res: GeocodingResult) => {
    let addr = formatAddress(res);
    const coords: [number, number] = [res.lat, res.lon];
    triggerHaptic('light');

    if (!res.address.house_number) {
      const match = searchText.match(/\d+$/);
      if (match && !addr.includes(match[0])) {
         addr = `${addr} ${match[0]}`.replace(/,,/g, ',');
      }
    }

    if (focusedInput === 'pickup') {
      onPickupChange(coords, addr);
      setFocusedInput('dropoff');
      setTimeout(() => dropoffInputRef.current?.focus(), 50);
    } else if (focusedInput === 'dropoff') {
      onDropoffChange(coords, addr);
      setIsPlanning(false);
      setStep('selection');
      triggerHaptic('success');
    } else if (typeof focusedInput === 'object') {
      const newStops = [...stops];
      newStops[focusedInput.index] = { position: coords, address: addr };
      onStopsChange(newStops);
      setFocusedInput('dropoff');
      setTimeout(() => dropoffInputRef.current?.focus(), 50);
    }
    setSuggestions([]);
  };

  const requestRide = async () => {
    if (!pickupLocation || !dropoffLocation) {
        showToast('Debes seleccionar origen y destino', 'error');
        return;
    }
    
    if (!session || (session.user?.phone && session.user.phone.startsWith('anon_'))) {
      if (session) showToast('Validación de teléfono requerida para solicitar viaje', 'info');
      onLoginRequired('Validación requerida para pedir viaje');
      return;
    }
    
    setLoading(true);
    triggerHaptic('medium');
    try {
      const dist = calculateDistance(pickupLocation[0], pickupLocation[1], dropoffLocation[0], dropoffLocation[1]);
      const duration = Math.ceil(dist * 2.5) + 2;
      const rate = VEHICLE_RATES[vehicleType] || VEHICLE_RATES['car'];
      const price = Math.ceil(rate.base + (dist * rate.km) + (duration * rate.min));

      const newRide = await APIClient.requestRide({
        pickup: { lat: pickupLocation[0], lng: pickupLocation[1], address: pickupAddress },
        dropoff: { lat: dropoffLocation[0], lng: dropoffLocation[1], address: dropoffAddress },
        type: rideType === 'errand' ? 'errand' : 'ride',
        price,
        distance: dist,
        duration,
        description: errandDescription,
        items: '',
      });
      
      setActiveRide(newRide);
      setStep('tracking');
      showToast('Buscando conductor...', 'success');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Clear suggestions when planning is closed
  useEffect(() => {
    if (!isPlanning) {
      setSuggestions([]);
    }
  }, [isPlanning]);


  const cancelRide = async (id: string) => {
    triggerHaptic('medium');
    try {
        await APIClient.cancelRide(id);
        showToast('Viaje cancelado', 'info');
        setActiveRide(null);
        setStep('service');
        onPlanningClose?.(); 
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error desconocido';
        showToast(message, 'error');
    }
  };

  if (step === 'tracking' && activeRide) {
    const statusMap = {
      'requested': 'Buscando tu auto...',
      'accepted': 'Conductor en camino',
      'arrived': 'Ha llegado',
      'in_progress': 'En viaje',
      'completed': 'Llegaste a tu destino',
      'cancelled': 'Viaje cancelado'
    };

    if (activeRide.status === 'completed') {
      return (
        <div className="ride-request-sheet fade-in">
           <PostRideSummary 
             ride={activeRide} 
             onClose={() => {
               setActiveRide(null);
               setStep('service');
               onPlanningClose?.();
             }} 
           />
        </div>
      );
    }

    return (
      <div className="ride-request-sheet fade-in">
        <div className="tracking-view-premium state-transition-enter" key={activeRide.status}>
          <div className="tracking-header-mini">
            <h2 className="tracking-status-text" style={{ 
              color: activeRide.status === 'arrived' ? '#10B981' : 'var(--text)',
              transition: 'color 0.4s ease'
             }}>
              {statusMap[activeRide.status]}
            </h2>
            <div className={`pulse-indicator ${activeRide.status === 'arrived' ? 'attention-pulse-bg' : ''}`} style={{ width: '12px', height: '12px' }}></div>
          </div>

          <div className={`driver-arrival-card stagger-in ${activeRide.status === 'arrived' ? 'attention-pulse-bg' : ''}`} style={{ transition: 'background-color 0.4s ease' }}>
             {activeRide.status === 'requested' ? (
               <div style={{ transform: 'scale(0.8)', margin: '-20px 0' }}>
                 <RadarSearch />
               </div>
             ) : (
               <div className="driver-main-info fade-in" style={{ gap: '20px' }}>
                  <div className="driver-photo-premium" style={{ width: '72px', height: '72px', fontSize: '36px' }}>
                     👤
                  </div>
                  <div className="driver-detail-premium">
                     <div className="driver-name-text" style={{ fontSize: '22px' }}>
                        {driverInfo?.fullName?.split(' ')[0] || 'Conductor'}
                     </div>
                     <div className="driver-rating-mini" style={{ fontSize: '14px', marginTop: '4px' }}>
                        <span>⭐ {driverInfo ? driverInfo.rating.toFixed(1) : '—'}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>• {driverInfo ? `${driverInfo.totalTrips.toLocaleString()} viajes` : 'Cargando...'}</span>
                     </div>
                  </div>
                  <div className="driver-action-mini">
                     <button className="icon-btn-mini interactive-scale" style={{ width: '48px', height: '48px', fontSize: '20px', background: '#F3F4F6', color: '#111827' }} onClick={() => { triggerHaptic('light'); window.open(`tel:1234567890`); }}>📞</button>
                  </div>
               </div>
             )}

             {activeRide.status !== 'requested' && (
               <div className="vehicle-badge-premium fade-in" style={{ marginTop: '24px', background: 'linear-gradient(135deg, #111827 0%, #1F2937 100%)', padding: '16px 20px' }}>
                  <div className="v-brand-plate">
                     <span className="v-plate-text" style={{ fontSize: '16px' }}>
                       {driverInfo?.licensePlate || '———'}
                     </span>
                     <span className="v-model-text" style={{ fontSize: '12px', color: '#9CA3AF' }}>
                       {driverInfo ? `${driverInfo.vehicleBrand} ${driverInfo.vehicleModel} ${driverInfo.vehicleYear}` : 'Cargando datos...'}
                     </span>
                  </div>
                  <div className="v-icon-m" style={{ fontSize: '32px' }}>
                    {driverInfo?.vehicleType === 'motorcycle' ? '🏍️' : driverInfo?.vehicleType === 'taxi' ? '🚕' : driverInfo?.vehicleType === 'rickshaw' ? '🛺' : '🚗'}
                  </div>
               </div>
             )}
          </div>
          
          <div className="tracking-meta-mini" style={{ background: 'var(--surface-alt)', padding: '20px', borderRadius: '24px', marginBottom: '24px', border: '1px solid var(--border-light)' }}>
             <div className="meta-row">
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Precio estimado</span> 
                <strong style={{ fontSize: '18px' }}>${activeRide.totalFare}</strong>
             </div>
             <div className="meta-row" style={{ marginBottom: 0 }}>
                <span style={{ fontWeight: 700, color: 'var(--text-muted)' }}>Método de pago</span> 
                <strong>💵 Efectivo</strong>
             </div>
          </div>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              className="interactive-scale" 
              onClick={() => {
                triggerHaptic('error');
                if (confirm('¿Deseas llamar a servicios de emergencia (911)?')) {
                  window.open('tel:911');
                }
              }}
              style={{ width: '60px', borderRadius: '16px', background: '#FEE2E2', color: '#EF4444', border: 'none', fontWeight: 900, fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              🆘
            </button>
            <button className="minimal-cancel-btn interactive-scale" style={{ flex: 1, marginTop: 0, background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0' }} onClick={() => cancelRide(activeRide.id)}>
              {activeRide.status === 'requested' ? 'Cancelar búsqueda' : 'Cancelar viaje'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isPlanning) {
    return (
      <div className="ride-planner full-screen fade-in">
        <div className="planner-header-minimal" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
           <button className="back-btn-minimal interactive-scale" onClick={() => { setIsPlanning(false); onPlanningClose?.(); triggerHaptic('light'); }} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
           <h2 className="planner-title-m" style={{ margin: 0, fontSize: '20px', fontWeight: 900 }}>¿A dónde vamos?</h2>
        </div>

        <div className="planner-inputs-minimal">
           <div className="uber-inputs-box">
              <div className="inputs-decoration">
                 <div className="dec-dot origin"></div>
                 <div className="dec-line"></div>
                 <div className="dec-dot dest"></div>
              </div>
              <div className="inputs-fields">
                <input 
                  ref={pickupInputRef}
                  autoFocus={focusedInput === 'pickup'}
                  className="minimal-input"
                  placeholder="Mi ubicación actual"
                  value={focusedInput === 'pickup' ? searchText : pickupAddress}
                  onChange={(e) => focusedInput === 'pickup' && handleSearch(e.target.value)}
                  onFocus={() => { setFocusedInput('pickup'); triggerHaptic('light'); }}
                />
                <div className="input-divider-mini"></div>
                <input 
                  ref={dropoffInputRef}
                  className="minimal-input"
                  placeholder="¿A dónde vas?"
                  value={focusedInput === 'dropoff' ? searchText : dropoffAddress}
                  onChange={(e) => focusedInput === 'dropoff' && handleSearch(e.target.value)}
                  onFocus={() => { setFocusedInput('dropoff'); triggerHaptic('light'); }}
                />
              </div>
           </div>
        </div>

        <div className="suggestions-list-minimal scrollable stagger-in">
           <div className="suggestion-item-minimal interactive-scale" onClick={() => { onStartMapSelection(focusedInput); triggerHaptic('medium'); }}>
             <div className="s-icon-m">🗺️</div>
             <div className="s-text-m">Fijar en el mapa</div>
           </div>

           {/* My current location button */}
           {(focusedInput === 'pickup' || focusedInput === 'dropoff') && (
             <div
               className={`suggestion-item-minimal my-location-item ${!userLocation ? 'disabled' : ''}`}
               onClick={() => {
                 if (userLocation && onUseMyLocation) {
                   onUseMyLocation(focusedInput as 'pickup' | 'dropoff').then(() => {
                     if (focusedInput === 'pickup') setFocusedInput('dropoff');
                     else {
                       setIsPlanning(false);
                       setStep('selection');
                     }
                   });
                 }
               }}
             >
               <div className="s-icon-m location-pulse-icon">
                 {geoLoading ? '⏳' : '📍'}
               </div>
               <div className="s-text-m">
                 <div className={`s-main ${geoLoading ? 'skeleton-loader' : ''}`}>
                   {geoLoading ? 'Obteniendo ubicación...' : 'Mi ubicación actual'}
                 </div>
                 {!geoLoading && !userLocation && (
                   <div className="s-sub" style={{ color: 'var(--text-muted)' }}>Permiso denegado</div>
                 )}
               </div>
               {!geoLoading && userLocation && (
                 <div className="s-badge-gps">GPS</div>
               )}
             </div>
           )}

           {suggestions.map((res, i) => {
             const mainAddr = res.address.road ? 
               (res.address.house_number ? `${res.address.road} ${res.address.house_number}` : res.address.road) : 
               res.display_name.split(',')[0];
             
             return (
               <div key={i} className="suggestion-item-minimal interactive-scale" onClick={() => selectSuggestion(res)}>
                 <div className="s-icon-m">📍</div>
                 <div className="s-text-m">
                   <div className="s-main">{mainAddr}</div>
                   <div className="s-sub">{res.display_name}</div>
                 </div>
               </div>
             );
           })}
        </div>
      </div>
    );
  }

  return (
    <div className="ride-request-sheet fade-in">
      
      {step === 'service' && (
        <div className="service-minimal-view stagger-in">
          <div className="service-header-mini" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <button className="back-btn-minimal interactive-scale" onClick={onPlanningClose} style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            <h2 className="minimal-title-large" style={{ margin: 0 }}>¿A dónde vamos?</h2>
          </div>
          <div className="minimal-address-card interactive-scale" onClick={() => { setIsPlanning(true); setFocusedInput('pickup'); triggerHaptic('light'); }}>
             <div className="addr-row-mini"><span className="dot-m origin"></span> {pickupAddress || 'Actual'}</div>
             <div className="addr-row-mini"><span className="dot-m dest"></span> {dropoffAddress || '¿A dónde vas?'}</div>
          </div>
          
          <div className="minimal-services-row">
             <button className="service-button-minimal interactive-scale" style={{ flex: 1 }} onClick={() => { onRideTypeChange('ride'); setIsPlanning(true); setFocusedInput('pickup'); triggerHaptic('medium'); }}>
                <span className="icon-m" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>🚗</span>
                <span className="label-m" style={{ fontWeight: 800 }}>Viaje</span>
             </button>
             <button className="service-button-minimal interactive-scale" style={{ flex: 1 }} onClick={() => { onRideTypeChange('errand'); setIsPlanning(true); setFocusedInput('pickup'); triggerHaptic('medium'); }}>
                <span className="icon-m" style={{ fontSize: '24px', display: 'block', marginBottom: '8px' }}>📦</span>
                <span className="label-m" style={{ fontWeight: 800 }}>Envío</span>
             </button>
          </div>

          {rideType === 'errand' && (
            <div className="errand-details-minimal stagger-in" style={{ marginTop: '24px' }}>
              <input 
                className="minimal-input-full"
                placeholder="¿Qué mandamos? (ej. Llaves, Comida, Paquete)"
                value={errandDescription}
                onChange={(e) => setErrandDescription(e.target.value)}
                style={{ width: '100%', padding: '16px', borderRadius: '16px', background: '#F3F4F6', border: '1px solid #E5E7EB', fontWeight: 700 }}
              />
            </div>
          )}
        </div>
      )}

      {step === 'selection' && (
        <div className="vehicle-selection-minimal fade-in">
          <div className="selection-header-minimal">
            <button className="back-btn-minimal interactive-scale" onClick={() => { setStep('service'); triggerHaptic('light'); }}>←</button>
            <div className="selection-path-mini" onClick={() => { setIsPlanning(true); triggerHaptic('light'); }}>
               {dropoffAddress.split(',')[0]}
            </div>
          </div>

          <div className="vehicle-list-minimal scrollable stagger-in">
            {loading ? (
                Array(4).fill(0).map((_, i) => (
                    <div key={i} className="vehicle-item-minimal">
                        <div className="v-icon-m skeleton-circle"></div>
                        <div className="v-meta-m">
                            <div className="skeleton skeleton-text" style={{ width: '60%' }}></div>
                            <div className="skeleton skeleton-text" style={{ width: '40%' }}></div>
                        </div>
                    </div>
                ))
            ) : (
                [
                { id: 'car', name: 'ZippX', icon: '🚗', cap: 4 },
                { id: 'taxi', name: 'Taxi', icon: '🚕', cap: 4 },
                { id: 'motorcycle', name: 'Moto', icon: '🏍️', cap: 1 },
                { id: 'rickshaw', name: 'Mototaxi', icon: '🛺', cap: 3 }
                ].map(v => {
                const dist = pickupLocation && dropoffLocation ? calculateDistance(pickupLocation[0], pickupLocation[1], dropoffLocation[0], dropoffLocation[1]) : 1;
                const duration = Math.ceil(dist * 2.5) + 2;
                const rate = VEHICLE_RATES[v.id] || VEHICLE_RATES['car'];
                const price = Math.ceil(rate.base + (dist * rate.km) + (duration * rate.min));
                
                return (
                    <div key={v.id} className={`vehicle-item-minimal interactive-scale ${vehicleType === v.id ? 'active' : ''}`} onClick={() => { setVehicleType(v.id); triggerHaptic('light'); }}>
                    <div className="v-icon-m">{v.icon}</div>
                    <div className="v-meta-m">
                        <div className="v-name-m">{v.name} • {v.cap} pers.</div>
                        <div className="v-eta-m">4 min</div>
                    </div>
                    <div className="v-price-m">${price}</div>
                    </div>
                );
                })
            )}
          </div>

          <div className="selection-footer-minimal">
             <div className="payment-mini interactive-scale" onClick={() => triggerHaptic('light')}>💵 Efectivo ▾</div>
             <button className="confirm-button-minimal interactive-scale" onClick={requestRide} disabled={loading}>
               {loading ? '...' : `Pedir ${vehicleType}`}
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
