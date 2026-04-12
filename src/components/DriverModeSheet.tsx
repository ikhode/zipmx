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
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);
  const [driverStats, setDriverStats] = useState<{todayEarnings?: number, todayTrips?: number} | null>(null);

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
        if (driver) {
          setIsOnline(driver.isActive);
          if (!driver.isActive) {
             APIClient.getDriverSettings().then(setDriverStats).catch(console.error);
          }
        }
        return;
      }

      try {
        const driver = await APIClient.getDriverSetup();
        if (!driver) setNeedsSetup(true);
        else {
          setNeedsSetup(false);
          setIsOnline(driver.isActive);
          if (!driver.isActive) {
             APIClient.getDriverSettings().then(setDriverStats).catch(console.error);
          }
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

  const toggleOnline = async () => {
    if (!session || (session.user?.phone && session.user.phone.startsWith('anon_'))) {
      onLoginRequired('Identifícate para empezar a conducir');
      return;
    }

    if (activeRide) {
      showToast('No puedes desconectarte durante un viaje activo', 'error');
      triggerHaptic('error');
      return;
    }

    triggerHaptic('medium');
    const newState = !isOnline;
    
    setIsOnline(newState);
    if (!newState) {
      setRides([]); // Clear rides if offline
      APIClient.getDriverSettings().then(setDriverStats).catch(console.error);
    }

    try {
      await APIClient.updateDriverStatus(newState);
      showToast(newState ? 'Estás en línea' : 'Te has desconectado', newState ? 'success' : 'info');
    } catch (e: unknown) {
      setIsOnline(!newState); // revertir
      const message = e instanceof Error ? e.message : 'Error al cambiar estado';
      showToast(message, 'error');
      triggerHaptic('error');
    }
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
      
      {showDisconnectConfirm && (
        <div className="custom-confirm-overlay fade-in" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
          <div className="custom-confirm-modal stagger-in" style={{ background: '#0F172A', borderRadius: '24px', padding: '32px 24px', width: '100%', maxWidth: '340px', textAlign: 'center', border: '1px solid #1E293B', boxShadow: '0 24px 48px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚫</div>
            <h3 style={{ fontSize: '22px', fontWeight: 900, marginBottom: '8px', color: 'white' }}>¿Finalizar Turno?</h3>
            <p style={{ color: '#94A3B8', marginBottom: '32px', fontSize: '15px', fontWeight: 500, lineHeight: 1.4 }}>
              Dejarás de recibir nuevas solicitudes de viajes cercanos.
            </p>
            <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
              <button 
                className="interactive-scale"
                style={{ flex: 1, padding: '16px', borderRadius: '16px', background: '#1E293B', color: 'white', fontWeight: 800, border: 'none', fontSize: '15px' }}
                onClick={() => setShowDisconnectConfirm(false)}
              >
                Cancelar
              </button>
              <button 
                className="interactive-scale"
                style={{ flex: 1, padding: '16px', borderRadius: '16px', background: '#EF4444', color: 'white', fontWeight: 800, border: 'none', boxShadow: '0 8px 16px rgba(239, 68, 68, 0.2)', fontSize: '15px' }}
                onClick={() => {
                  setShowDisconnectConfirm(false);
                  toggleOnline();
                }}
              >
                Desconectar
              </button>
            </div>
          </div>
        </div>
      )}

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
            {isOnline && (
              <div className="online-header-premium fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', padding: '0 8px' }}>
                <div style={{ padding: '10px 20px', background: '#F1F5F9', borderRadius: '100px', color: '#0F172A', fontWeight: 900, fontSize: '13px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                  <div className="pulse-indicator" style={{ background: '#3B82F6', width: '10px', height: '10px', boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.7)' }}></div> EN LÍNEA
                </div>
                <button 
                    className="interactive-scale stop-btn-premium" 
                    onClick={() => setShowDisconnectConfirm(true)}
                    style={{ background: '#EF4444', border: '2px solid white', width: '48px', height: '48px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px rgba(239, 68, 68, 0.4)' }}
                    title="Desconectarse"
                >
                  <div style={{ width: '16px', height: '16px', background: 'white', borderRadius: '4px' }}></div>
                </button>
              </div>
            )}

            {!isOnline ? (
              <div className="offline-state-premium fade-in" style={{ textAlign: 'center', padding: '20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                
                {/* Stats Panel */}
                <div style={{ width: '100%', maxWidth: '340px', background: 'white', borderRadius: '24px', padding: '20px', marginBottom: '28px', boxShadow: '0 8px 24px rgba(0,0,0,0.06)', border: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
                   <div style={{ textAlign: 'center' }}>
                     <p style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ganancias de hoy</p>
                     <p style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                       <span style={{ fontSize: '18px', color: '#10B981', marginRight: '2px' }}>$</span>
                       {driverStats?.todayEarnings?.toFixed(2) || '0.00'}
                     </p>
                   </div>
                   <div style={{ width: '1px', height: '48px', background: '#E2E8F0' }}></div>
                   <div style={{ textAlign: 'center' }}>
                     <p style={{ fontSize: '12px', fontWeight: 800, color: '#64748B', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Viajes de hoy</p>
                     <p style={{ fontSize: '28px', fontWeight: 900, color: '#0F172A', letterSpacing: '-0.02em' }}>
                       {driverStats?.todayTrips || '0'}
                     </p>
                   </div>
                </div>

                <button 
                  className="uber-go-button interactive-scale" 
                  onClick={toggleOnline}
                >
                  <div className="go-pulse-ring"></div>
                  <div className="go-pulse-ring-2"></div>
                  <div className="go-btn-content">
                    <span className="go-text">INICIAR</span>
                    <span className="go-subtext">TURNO</span>
                  </div>
                </button>
                <div style={{ marginTop: '40px', background: '#FFF8F1', border: '1px solid #FFE4CD', padding: '16px 24px', borderRadius: '16px' }}>
                   <p style={{ color: '#C2410C', fontWeight: 800, fontSize: '14px', margin: 0 }}>Desconectado</p>
                   <p style={{ color: '#9A3412', fontWeight: 500, fontSize: '13px', marginTop: '4px' }}>Toca el botón superior para empezar a recibir viajes.</p>
                </div>
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
