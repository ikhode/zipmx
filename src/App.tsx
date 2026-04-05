import React, { useState, useEffect, useCallback, useMemo } from 'react';
import APIClient, { APIUser } from './lib/api';
import { MapView } from './components/MapView';
import { RideRequestSheet } from './components/RideRequestSheet';
import { PassengerHome } from './components/PassengerHome';
import { PromoDetailsSheet } from './components/PromoDetailsSheet';
import { AccountMenuSheet } from './components/AccountMenuSheet';
import { DriverModeSheet } from './components/DriverModeSheet';
import { Auth } from './components/Auth';
import { BottomSheet } from './components/BottomSheet';
import { VerificationSheet } from './components/VerificationSheet';
import { StatusBanner } from './components/StatusBanner';
import { QuickAuthSplash } from './components/QuickAuthSplash';
import { reverseGeocode, formatAddress } from './lib/geocoding';

type AppMode = 'passenger' | 'driver';
type SelectionType = 'none' | 'pickup' | 'dropoff' | { type: 'stop', index: number };

// --- Memoized Sub-components ---

const MapSelectionOverlay = React.memo(({ 
  tempAddress, onConfirm, onCancel 
}: { 
  tempAddress: string, onConfirm: () => void, onCancel: () => void 
}) => {
  return (
    <div className="map-selection-minimal">
      <button className="minimal-back-btn" onClick={onCancel}>←</button>
      <div className="center-pin-minimal"></div>
      
      <div className="selection-sheet-minimal">
        <div className="selection-address-mini">{tempAddress}</div>
        <button className="confirm-button-minimal" onClick={onConfirm}>
          Confirmar ubicación
        </button>
      </div>
    </div>
  );
});

const MemoizedMapView = React.memo(MapView);

export default function App() {
  const [session, setSession] = useState<{ user: APIUser } | null>(null);
  const [mode, setMode] = useState<AppMode>('passenger');
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [selectionMode, setSelectionMode] = useState<SelectionType>('none');
  const [planningStarted, setPlanningStarted] = useState(false);
  const [showPromoDetails, setShowPromoDetails] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [currentRideType, setCurrentRideType] = useState<'ride' | 'errand' | 'taxi' | 'mototaxi'>('ride');
  
  // Locations State
  const [pickupLocation, setPickupLocation] = useState<[number, number] | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>('');
  const [dropoffLocation, setDropoffLocation] = useState<[number, number] | null>(null);
  const [dropoffAddress, setDropoffAddress] = useState<string>('');
  const [stops, setStops] = useState<{ position: [number, number], address: string }[]>([]);
  
  // Temp state for map selection
  const [tempLocation, setTempLocation] = useState<[number, number] | null>(null);
  const [tempAddress, setTempAddress] = useState<string>('Buscando dirección...');
  // Ubicación inicial al entrar al modo selección (NO se actualiza al arrastrar el mapa)
  const [selectionInitialLocation, setSelectionInitialLocation] = useState<[number, number] | null>(null);
  const [isHeaderHidden, setIsHeaderHidden] = useState(false);
  const [hasActiveRide, setHasActiveRide] = useState(false);
  const [showVerificationSheet, setShowVerificationSheet] = useState<{ type: 'passenger' | 'driver' } | null>(null);
  const [nearbyDrivers, setNearbyDrivers] = useState<{ id: string; position: [number, number]; type: string }[]>([]);
  const [mapBounds, setMapBounds] = useState<[number, number] | null>([19.0148, -104.2403]);
  const [showQuickAuth, setShowQuickAuth] = useState(false);
  const [quickAuthType, setQuickAuthType] = useState<'passenger' | 'driver'>('passenger');
  const [flyToTrigger, setFlyToTrigger] = useState(0);

  const onLoginRequired = (type: 'passenger' | 'driver') => {
    setQuickAuthType(type);
    setShowQuickAuth(true);
  };

  const handleOpenAuth = useCallback(() => onLoginRequired('passenger'), []);

  useEffect(() => {
    APIClient.getProfile().then(user => setSession(user ? { user } : null));

    // --- Hash Based Routing ---
    const handleHashSync = () => {
      const hash = window.location.hash;
      if (hash === '#/profile') {
          setShowAccountMenu(true);
      } else if (hash === '#/driver') {
          setMode('driver');
          setPlanningStarted(false);
      } else if (hash === '#/passenger') {
          setMode('passenger');
      } else if (hash === '#/') {
          setShowAccountMenu(false);
      }
    };

    handleHashSync();
    window.addEventListener('popstate', handleHashSync);

    window.addEventListener('open-auth', handleOpenAuth);
    return () => {
        window.removeEventListener('open-auth', handleOpenAuth);
        window.removeEventListener('popstate', handleHashSync);
    };
  }, [handleOpenAuth]);

  // Sync state to hash
  useEffect(() => {
    let hash = '#/';
    if (showAccountMenu) hash = '#/profile';
    else if (mode === 'driver') hash = '#/driver';
    else if (mode === 'passenger') hash = '#/passenger';

    if (window.location.hash !== hash) {
       window.history.pushState(null, '', hash);
    }
  }, [mode, showAccountMenu]);

  // Nearby Drivers Polling
  useEffect(() => {
    if (mode === 'passenger' && !hasActiveRide && mapBounds) {
       const fetchNearby = () => {
         APIClient.getNearbyDrivers(mapBounds[0], mapBounds[1]).then((res: any) => {
            if (res.drivers) setNearbyDrivers(res.drivers);
         });
       };
       fetchNearby();
       const interval = setInterval(fetchNearby, 10000);
       return () => clearInterval(interval);
    }
  }, [mode, hasActiveRide, mapBounds]);

  // Set initial temp location when entering selection mode
  useEffect(() => {
    if (selectionMode !== 'none') {
      let initial: [number, number] | null = null;
      if (selectionMode === 'pickup') initial = pickupLocation;
      else if (selectionMode === 'dropoff') initial = dropoffLocation;
      else if (typeof selectionMode === 'object' && selectionMode.type === 'stop') {
        initial = stops[selectionMode.index]?.position || null;
      }
      const loc: [number, number] = initial || [19.0148, -104.2403];
      setTempLocation(loc);
      // Guardar la ubicación inicial para el center del mapa (no se mueve con el drag)
      setSelectionInitialLocation(loc);
      // Forzar que el mapa vuele a esta ubicación inicial
      setFlyToTrigger(prev => prev + 1);
    } else {
      setSelectionInitialLocation(null);
    }
  }, [selectionMode]);

  // Debounced geocoding for temp selection
  useEffect(() => {
    if (!tempLocation || selectionMode === 'none') return;
    
    const timer = setTimeout(() => {
      reverseGeocode(tempLocation[0], tempLocation[1]).then((res) => {
        if (res) setTempAddress(formatAddress(res));
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [tempLocation, selectionMode]);

  const handleLocationSelected = useCallback((loc: [number, number]) => {
    setTempLocation(loc);
    setMapBounds(loc);
  }, []);

  const confirmSelection = useCallback(() => {
    if (!tempLocation) return;
    
    if (selectionMode === 'pickup') {
      setPickupLocation(tempLocation);
      setPickupAddress(tempAddress);
    } else if (selectionMode === 'dropoff') {
      setDropoffLocation(tempLocation);
      setDropoffAddress(tempAddress);
    } else if (typeof selectionMode === 'object' && selectionMode.type === 'stop') {
      const newStops = [...stops];
      newStops[selectionMode.index] = { position: tempLocation, address: tempAddress };
      setStops(newStops);
    }
    setSelectionMode('none');
  }, [tempLocation, tempAddress, selectionMode, stops]);

  const stopPositions = useMemo<[number, number][]>(() => stops.map(s => s.position), [stops]);

  const mapCenter = useMemo<[number, number]>(() => {
    // En modo selección usamos la ubicación INICIAL (fijada al entrar),
    // NO tempLocation que cambia con cada drag del mapa (evita el loop de feedback)
    if (selectionMode !== 'none' && selectionInitialLocation) return selectionInitialLocation;
    return pickupLocation || [19.0148, -104.2403];
  }, [selectionMode, selectionInitialLocation, pickupLocation]);

  // --- Passenger Handlers ---
  const handleStartPlanning = useCallback((_field?: 'pickup' | 'dropoff') => setPlanningStarted(true), []);
  const handleSelectService = useCallback((type: 'ride' | 'errand' | 'taxi' | 'mototaxi') => {
    setCurrentRideType(type);
    setPlanningStarted(true);
  }, []);
  const handlePromoClick = useCallback(() => setShowPromoDetails(true), []);
  const handleAccountMenuOpen = useCallback(() => setShowAccountMenu(true), []);
  const handleModeSelectorClose = useCallback(() => setShowModeSelector(false), []);
  const handleAccountMenuClose = useCallback(() => setShowAccountMenu(false), []);
  const handlePromoClose = useCallback(() => setShowPromoDetails(false), []);

  const handlePickupChange = useCallback((loc: [number, number] | null, addr?: string) => {
    if (loc) setPickupLocation(loc);
    if (addr) setPickupAddress(addr);
  }, []);

  const handleDropoffChange = useCallback((loc: [number, number] | null, addr?: string) => {
    if (loc) setDropoffLocation(loc);
    if (addr) setDropoffAddress(addr);
  }, []);

  return (
    <div className={`app-container ${mode === 'passenger' && !pickupLocation && !dropoffLocation && selectionMode === 'none' ? 'is-home' : ''}`}>
      <StatusBanner />
      <div className="map-wrapper">
        <MemoizedMapView 
          center={mapCenter}
          pickupLocation={pickupLocation || undefined}
          dropoffLocation={dropoffLocation || undefined}
          stops={stopPositions}
          selectingLocation={selectionMode !== 'none'}
          nearbyDrivers={nearbyDrivers}
          onLocationSelected={handleLocationSelected}
          flyToTrigger={flyToTrigger}
        />
      </div>

      {/* Dynamic Header: Visible only when NOT in Selection Mode */}
      {selectionMode === 'none' && (
        <div className={`app-header ${isHeaderHidden ? 'hidden' : ''} mode-${mode}`}>
          <div className="passenger-top-actions">
            {!session ? (
              <button 
                className="minimal-auth-btn" 
                onClick={() => setShowModeSelector(true)}
              >
                Identifícate
              </button>
            ) : (
              <button 
                className="minimal-pill-btn" 
                onClick={() => setShowModeSelector(true)}
              >
                {mode === 'passenger' ? 'Pasajero' : 'Conductor'}
              </button>
            )}
            
            <button className="minimal-menu-btn" onClick={handleAccountMenuOpen}>
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="6" x2="20" y2="6"></line><line x1="4" y1="18" x2="20" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}

      {selectionMode !== 'none' && (
        <MapSelectionOverlay 
          tempAddress={tempAddress}
          onConfirm={confirmSelection}
          onCancel={() => setSelectionMode('none')}
        />
      )}

       {selectionMode === 'none' && (
        <div className={`scroll-content experience-${mode}`}>
          {mode === 'passenger' ? (
            !pickupLocation && !dropoffLocation && !planningStarted ? (
              <div className="home-content" style={{ pointerEvents: 'auto' }}>
                <PassengerHome 
                  dropoffAddress={dropoffAddress}
                  onStartPlanning={handleStartPlanning}
                  onSelectService={handleSelectService}
                  onPromoClick={handlePromoClick}
                />
                <div className="home-map-preview-placeholder"></div>
              </div>
            ) : (
                <div className="scroll-card">
                  {!session && !hasActiveRide && (
                    <div className="guest-cta-minimal fade-in">
                      <span className="pill-badge">Explora Zipp</span>
                      <p>Identifícate para proteger tu viaje y ver precios exactos</p>
                      <button onClick={() => setShowModeSelector(true)}>INICIAR SESIÓN</button>
                    </div>
                  )}
                  
                  <RideRequestSheet
                    session={session}
                    initialPlanning={planningStarted}
                    onPlanningClose={() => setPlanningStarted(false)}
                    pickupLocation={pickupLocation}
                    pickupAddress={pickupAddress}
                    dropoffLocation={dropoffLocation}
                    dropoffAddress={dropoffAddress}
                    stops={stops}
                    onPickupChange={handlePickupChange}
                    onDropoffChange={handleDropoffChange}
                    onStopsChange={setStops}
                    onStartMapSelection={(mode: any) => setSelectionMode(mode)}
                    onRideTypeChange={setCurrentRideType}
                    onLoginRequired={() => onLoginRequired('passenger')}
                    preSelectedVehicle={currentRideType === 'taxi' || currentRideType === 'mototaxi' ? currentRideType : undefined}
                    onHeaderVisibilityChange={setIsHeaderHidden}
                    onActiveRideChange={setHasActiveRide}
                  />
                </div>
            )
          ) : (
             <div className="driver-focused-view">
               <DriverModeSheet 
                 session={session} 
                 onActiveRideChange={setHasActiveRide} 
                 onLoginRequired={() => onLoginRequired('driver')}
               />
             </div>
          )}
        </div>
      )}

      {showQuickAuth && (
        <QuickAuthSplash 
          userType={quickAuthType}
          onClose={() => setShowQuickAuth(false)}
          onShowFullAuth={() => {
            setShowQuickAuth(false);
            setShowModeSelector(true);
          }}
        />
      )}

      <BottomSheet
        isOpen={showPromoDetails}
        onClose={handlePromoClose}
        snapPoints={[0.9]}
        initialSnap={0}
      >
        <PromoDetailsSheet onClose={handlePromoClose} />
      </BottomSheet>
      
      <BottomSheet
        isOpen={showAccountMenu}
        onClose={handleAccountMenuClose}
        snapPoints={[0.9]}
        initialSnap={0}
      >
        <AccountMenuSheet 
          session={session} 
          currentMode={mode}
          hasActiveRide={hasActiveRide}
          onClose={handleAccountMenuClose} 
          onSwitchMode={() => { 
            if (hasActiveRide) {
               alert("No puedes cambiar de modo con un viaje activo");
               return;
            }
            
            // Direct auto-switch logic
            if (mode === 'passenger') {
               // Try to switch to driver
               if (session && !session.user.verified) {
                  setShowAccountMenu(false);
                  setShowVerificationSheet({ type: 'driver' });
               } else {
                  setMode('driver');
                  setPlanningStarted(false);
                  setShowAccountMenu(false);
               }
            } else {
               // Switch back to passenger
               setMode('passenger');
               setShowAccountMenu(false);
            }
          }}
        />
      </BottomSheet>

      <BottomSheet
        isOpen={showModeSelector}
        onClose={handleModeSelectorClose}
        snapPoints={[0.4]}
        initialSnap={0}
      >
        <div className="mode-selector">
          <h3 className="mode-selector-title">Selecciona tu modo</h3>
          <div className="mode-options">
            <button
              className={`mode-option ${mode === 'passenger' ? 'active' : ''}`}
              onClick={() => { setMode('passenger'); setShowModeSelector(false); }}
            >
              <div className="mode-badge"></div>
              <span className="mode-icon">🚗</span>
              <span className="mode-label">Pasajero</span>
            </button>
            <button
              className={`mode-option ${mode === 'driver' ? 'active' : ''}`}
              onClick={() => { 
                if (session && !session.user.verified) {
                   setShowModeSelector(false);
                   setShowVerificationSheet({ type: 'driver' });
                   return;
                }
                setMode('driver'); 
                setShowModeSelector(false); 
              }}
            >
              <div className="mode-badge"></div>
              <span className="mode-icon">👨‍✈️</span>
              <span className="mode-label">Conductor</span>
            </button>
          </div>
          
          <div className="auth-footer-minimal">
            {!session ? (
              <Auth />
            ) : (
              <button className="cancel-link-btn" onClick={() => { APIClient.logout(); window.location.reload(); }}>
                Cerrar Sesión
              </button>
            )}
          </div>
        </div>
      </BottomSheet>

      <BottomSheet
        isOpen={!!showVerificationSheet}
        onClose={() => setShowVerificationSheet(null)}
        snapPoints={[0.9]}
        initialSnap={0}
      >
        {showVerificationSheet && (
          <VerificationSheet 
            type={showVerificationSheet.type}
            onClose={() => setShowVerificationSheet(null)}
            onComplete={(user) => {
               setSession({ user });
               setShowVerificationSheet(null);
               if (showVerificationSheet.type === 'driver') setMode('driver');
            }}
          />
        )}
      </BottomSheet>
    </div>
  );
}
