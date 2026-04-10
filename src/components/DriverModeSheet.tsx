import React, { useState, useEffect, useCallback, useMemo } from 'react';
import APIClient, { APIUser, APIRide } from '../lib/api';
import { useToast } from './ToastProvider';
import { triggerHaptic } from '../lib/haptics';
import { PostRideSummary } from './PostRideSummary';

interface DriverModeSheetProps {
  session: { user: APIUser } | null;
  onActiveRideChange?: (active: boolean) => void;
  onLoginRequired: (reason?: string) => void;
  onOnlineChange?: (online: boolean) => void;
  onUserUpdate?: (user: APIUser) => void;
  activeRideOverride?: APIRide;
}

type VehicleType = 'car' | 'motorcycle' | 'bicycle' | 'rickshaw' | 'taxi' | 'skates';

interface RideCardProps {
  ride: APIRide;
  onAccept?: (id: string) => void;
  onArrive?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
}

const RideCard = React.memo(({ ride, onAccept }: RideCardProps) => {
  const isActionable = ride.status === 'requested' || ride.status === 'accepted' || ride.status === 'arrived' || ride.status === 'in_progress';

  return (
    <div className={`driver-ride-card fade-in ${!isActionable ? 'completed' : ''}`}>
      <div className="ride-icon-mini">{ride.rideType === 'ride' ? '🚗' : '📦'}</div>
      <div className="ride-info-mini">
        <div className="addr-mini">📍 {ride.pickupAddress.split(',')[0]}</div>
        <div className="addr-mini">🎯 {ride.dropoffAddress.split(',')[0]}</div>
        <div className="fare-mini">${ride.totalFare.toFixed(0)}</div>
      </div>
      <div className="ride-actions-mini">
        {ride.status === 'requested' && onAccept && (
          <button className="confirm-button-minimal interactive-scale" onClick={() => { triggerHaptic('medium'); onAccept(ride.id); }}>ACEPTAR</button>
        )}
      </div>
    </div>
  );
});

const ActiveRideFocused = ({ 
  ride, 
  onArrive, 
  onStart, 
  onComplete 
}: { 
  ride: APIRide, 
  onArrive: () => void, 
  onStart: () => void, 
  onComplete: () => void 
}) => {
  return (
    <div className="active-ride-detail-view state-transition-enter" key={ride.status}>
      <div className="glass-v2-card stagger-in" style={{ padding: '24px', marginBottom: '16px' }}>
        <div className="active-trip-header">
          <div className="trip-type-badge">
            <span>{ride.rideType === 'ride' ? '🚗 VIAJE' : '📦 ENVÍO'}</span>
            <div className="pulse-indicator"></div>
          </div>
          <div className="trip-fare-premium">${ride.totalFare}</div>
        </div>

        <div className="trip-locations-focused" style={{ marginTop: '20px' }}>
          <div className="focused-addr-row">
            <div className="addr-dot-focused"></div>
            <div className="addr-info-focused">
              <div className="addr-label-focused">Recogida</div>
              <div className="addr-text-focused">{ride.pickupAddress.split(',')[0]}</div>
            </div>
          </div>

          <div className="focused-addr-row" style={{ marginTop: '16px' }}>
            <div className="addr-dot-focused dest"></div>
            <div className="addr-info-focused">
              <div className="addr-label-focused">Destino</div>
              <div className="addr-text-focused">{ride.dropoffAddress.split(',')[0]}</div>
            </div>
          </div>
        </div>

        <div className="trip-actions-grid" style={{ marginTop: '32px' }}>
          {ride.status === 'accepted' && (
            <button className="action-btn-premium arrive interactive-scale" onClick={() => { triggerHaptic('medium'); onArrive(); }}>
              <span>Llegué al punto</span>
              <span>📍</span>
            </button>
          )}
          {ride.status === 'arrived' && (
            <button className="action-btn-premium start interactive-scale attention-pulse-bg" style={{ backgroundColor: 'transparent', backgroundImage: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)' }} onClick={() => { triggerHaptic('success'); onStart(); }}>
              <span>Iniciar Viaje</span>
              <span>🚀</span>
            </button>
          )}
          {ride.status === 'in_progress' && (
            <button className="action-btn-premium complete interactive-scale" onClick={() => { triggerHaptic('success'); onComplete(); }}>
              <span>Finalizar Viaje</span>
              <span>🏁</span>
            </button>
          )}
        </div>
      </div>

      <div className="stagger-in" style={{ animationDelay: '0.3s' }}>
         <div style={{ display: 'flex', gap: '12px' }}>
            <button className="premium-auth-btn interactive-scale" style={{ flex: 1, padding: '16px', borderRadius: '16px', justifyContent: 'center', background: 'white', color: 'black', border: '1px solid #E5E7EB' }} onClick={() => window.open(`tel:${ride.passengerId.substring(0, 10)}`)}>
              <span style={{ fontSize: '18px', marginRight: '8px' }}>📞</span>
              <span style={{ fontWeight: 800 }}>Llamar</span>
            </button>
            <button 
                className="premium-auth-btn interactive-scale" 
                style={{ flex: 1, padding: '16px', borderRadius: '16px', justifyContent: 'center', background: '#111827', color: 'white', border: 'none' }}
                onClick={() => {
                   const dest = ride.status === 'accepted' ? 
                     `${ride.pickupLatitude},${ride.pickupLongitude}` : 
                     `${ride.dropoffLatitude},${ride.dropoffLongitude}`;
                   window.open(`https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=driving`);
                }}
            >
              <span style={{ fontSize: '18px', marginRight: '8px' }}>🚀</span>
              <span style={{ fontWeight: 800 }}>Navegar</span>
            </button>
         </div>
      </div>
    </div>
  );
};

const AcceptanceSplash = ({ onFinish }: { onFinish: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onFinish, 1500);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <div className="acceptance-splash-overlay" onClick={onFinish}>
      <div className="acceptance-checkmark-anim">✓</div>
      <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '8px' }}>¡Viaje Aceptado!</h2>
      <p style={{ opacity: 0.8, fontWeight: 600 }}>Cargando detalles del pasajero...</p>
    </div>
  );
};

const SearchingRadar = () => (
  <div className="searching-radar-premium fade-in">
    <div className="radar-v2">
      <div className="ring"></div>
      <div className="ring"></div>
      <div className="ring"></div>
      <div className="radar-center-premium">📡</div>
    </div>
    <div className="searching-text-premium">Buscando solicitudes</div>
    <div className="searching-subtext-premium">Mantente alerta a nuevas notificaciones</div>
  </div>
);

export function DriverModeSheet({ session, onActiveRideChange, onLoginRequired, onOnlineChange, onUserUpdate, activeRideOverride }: DriverModeSheetProps) {
  const { showToast } = useToast();
  const [rides, setRides] = useState<APIRide[]>([]);
  const [activeRide, setActiveRide] = useState<APIRide | null>(null);
  const [showAcceptanceSplash, setShowAcceptanceSplash] = useState(false);

  useEffect(() => {
    if (activeRideOverride) {
      setActiveRide(activeRideOverride);
    } else {
      setActiveRide(null);
    }
  }, [activeRideOverride]);

  useEffect(() => {
    onActiveRideChange?.(!!activeRide);
  }, [activeRide, onActiveRideChange]);
  
  const [isOnline, setIsOnline] = useState(false);
  
  useEffect(() => {
    onOnlineChange?.(isOnline);
  }, [isOnline, onOnlineChange]);
  const [needsSetup, setNeedsSetup] = useState(session?.user?.userType === 'passenger');
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const ridesData = await APIClient.getAvailableRides();
      if (ridesData) setRides(ridesData);
    } catch (error) {
      console.error('Fetch error:', error);
    }
  }, [session]);

  useEffect(() => {
    if (!session) {
      setNeedsSetup(true);
      return;
    }

    const checkSetup = async () => {
      if (session.user.userType === 'driver') {
        setNeedsSetup(false);
        const driver = await APIClient.getDriverSetup();
        if (driver) setIsOnline(driver.isActive);
        return;
      }

      try {
        const driver = await APIClient.getDriverSetup();
        if (!driver) setNeedsSetup(true);
        else {
          setNeedsSetup(false);
          setIsOnline(driver.isActive);
        }
      } catch {
        setNeedsSetup(true);
      }
    };

    checkSetup();
    fetchData();
    const interval = setInterval(() => {
        if (isOnline || activeRide) fetchData();
    }, 8000);
    return () => clearInterval(interval);
  }, [session, fetchData, isOnline, activeRide]);

  const setupDriver = async () => {
    if (!session || (session.user?.phone && session.user.phone.startsWith('anon_'))) {
      onLoginRequired('Identifícate para empezar a conducir');
      return;
    }
    setLoading(true);
    triggerHaptic('medium');
    try {
      const mappedType = vehicleType === 'skates' ? 'bicycle' : vehicleType;
      await APIClient.setupDriver(mappedType as any);
      
      const updatedUser = await APIClient.getProfile();
      if (updatedUser) {
        onUserUpdate?.(updatedUser);
      }
      
      setNeedsSetup(false);
      setIsOnline(true);
      showToast('¡Configuración completada!', 'success');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error en configuración';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = useCallback(async (status: 'accepted' | 'arrived' | 'in_progress' | 'completed') => {
    if (!activeRide) return;
    triggerHaptic('light');
    try {
      await APIClient.updateRideStatus(activeRide.id, status);
      if (status === 'completed') {
          showToast('Viaje finalizado con éxito', 'success');
          triggerHaptic('success');
      }
      setActiveRide(prev => prev ? { ...prev, status } : prev);
      fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al actualizar estado';
      showToast(message, 'error');
    }
  }, [activeRide, fetchData, showToast]);

  const handleAcceptRide = useCallback(async (id: string) => {
    triggerHaptic('success');
    setLoading(true);
    try {
      await APIClient.acceptRide(id);
      setShowAcceptanceSplash(true);
      const active = await APIClient.getActiveRide();
      if (active) {
        setActiveRide(active);
      }
      fetchData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error al aceptar viaje';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [fetchData, showToast]);

  const toggleOnline = () => {
    if (!session || (session.user?.phone && session.user.phone.startsWith('anon_'))) {
      onLoginRequired('Identifícate para empezar a conducir');
      return;
    }
    triggerHaptic('medium');
    setIsOnline(!isOnline);
    showToast(isOnline ? 'Te has desconectado' : 'Estás en línea', isOnline ? 'info' : 'success');
  };

  const vehicleOptions = useMemo(() => [
    { type: 'taxi', icon: '🚕', label: 'Taxi' },
    { type: 'car', icon: '🚗', label: 'Auto' },
    { type: 'rickshaw', icon: '🛺', label: 'Mototaxi' },
    { type: 'motorcycle', icon: '🏍️', label: 'Moto' },
    { type: 'bicycle', icon: '🚲', label: 'Bici' },
    { type: 'skates', icon: '🛼', label: 'Patineta' }
  ], []);

  if (needsSetup) {
    return (
      <div className="driver-setup-minimal fade-in stagger-in">
        <h2 className="minimal-title-large">Comienza a ganar</h2>
        <p className="minimal-desc-sm">Selecciona tu vehículo para empezar</p>
        <div className="minimal-vehicle-grid">
          {vehicleOptions.map(v => (
            <button 
                key={v.type} 
                data-testid={`vehicle-btn-${v.type}`}
                className={`minimal-vehicle-btn interactive-scale ${vehicleType === v.type ? 'active' : ''}`} 
                onClick={() => { triggerHaptic('light'); setVehicleType(v.type as any); }}
            >
              <span className="v-icon">{v.icon}</span>
              <span className="v-label">{v.label}</span>
            </button>
          ))}
        </div>
        {!session && (
          <div className="guest-badge-minimal" style={{ marginBottom: '20px', background: '#F1F5F9', padding: '12px', borderRadius: '12px', fontSize: '13px', color: '#64748B', textAlign: 'center' }}>
            🔒 Modo Invitado: Se requiere iniciar sesión para activarte
          </div>
        )}
        <button className="confirm-button-minimal interactive-scale" data-testid="driver-setup-btn" onClick={setupDriver} disabled={loading}>
          {loading ? '...' : session ? 'Empezar' : 'Identificarme y Empezar'}
        </button>
      </div>
    );
  }

  return (
    <div className="driver-mode-sheet premium-card-anim">
      <div className="sheet-handle-minimal"></div>
      {showAcceptanceSplash && <AcceptanceSplash onFinish={() => setShowAcceptanceSplash(false)} />}
      
      <div className="driver-status-bar" style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px', marginTop: '12px' }}>
          <button 
              className={`status-toggle-pill interactive-scale ${isOnline ? 'online' : 'offline'}`} 
              onClick={toggleOnline}
              style={{ padding: '14px 28px', borderRadius: '100px', fontWeight: 900, fontSize: '13px', letterSpacing: '0.08em' }}
          >
            {isOnline ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="pulse-indicator"></div>
                EN LÍNEA
              </span>
            ) : (
              <span style={{ opacity: 0.6 }}>DESCONECTADO</span>
            )}
          </button>
      </div>

      <div className="driver-content-transition" key={activeRide ? 'active' : 'available'}>
        {activeRide ? (
          <div className="active-ride-section">
            {activeRide.status === 'completed' ? (
                <PostRideSummary 
                    ride={activeRide} 
                    isDriver 
                    onClose={() => {
                        setActiveRide(null);
                        fetchData();
                    }} 
                />
            ) : (
                <ActiveRideFocused 
                    ride={activeRide} 
                    onArrive={() => handleUpdateStatus('arrived')}
                    onStart={() => handleUpdateStatus('in_progress')} 
                    onComplete={() => handleUpdateStatus('completed')} 
                />
            )}
          </div>
        ) : (
          <div className="available-rides-section stagger-in">
            {!isOnline ? (
              <div className="offline-state-premium fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <div style={{ fontSize: '48px', marginBottom: '20px', filter: 'grayscale(1)', opacity: 0.5 }}>😴</div>
                <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>Estás fuera de servicio</h3>
                <p style={{ color: '#6B7280', fontWeight: 600, fontSize: '14px' }}>Conéctate para empezar a recibir solicitudes de viajes cercanas.</p>
              </div>
            ) : rides.length === 0 ? (
              <SearchingRadar />
            ) : (
              <div className="rides-list-container">
                <h3 style={{ fontSize: '16px', fontWeight: 900, marginBottom: '20px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Solicitudes cercanas</h3>
                <div className="rides-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {rides.map(ride => (
                    <RideCard key={ride.id} ride={ride} onAccept={handleAcceptRide} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
