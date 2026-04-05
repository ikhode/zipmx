import React, { useState, useEffect, useCallback, useMemo } from 'react';
import APIClient, { APIRide } from '../lib/api';
import { useToast } from './ToastProvider';
import { triggerHaptic } from '../lib/haptics';

interface DriverModeSheetProps {
  session: any;
  onActiveRideChange?: (active: boolean) => void;
  onLoginRequired: () => void;
}

type VehicleType = 'car' | 'motorcycle' | 'bicycle' | 'rickshaw' | 'taxi' | 'skates';

interface RideCardProps {
  ride: APIRide;
  onAccept?: (id: string) => void;
  onArrive?: () => void;
  onStart?: () => void;
  onComplete?: () => void;
}

const RideCard = React.memo(({ ride, onAccept, onArrive, onStart, onComplete }: RideCardProps) => {
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
        {ride.status === 'accepted' && onArrive && (
          <button className="confirm-button-minimal interactive-scale" onClick={() => { triggerHaptic('medium'); onArrive(); }}>LLEGUÉ</button>
        )}
        {ride.status === 'arrived' && onStart && (
          <button className="confirm-button-minimal interactive-scale" onClick={() => { triggerHaptic('medium'); onStart(); }}>INICIAR</button>
        )}
        {ride.status === 'in_progress' && onComplete && (
          <button className="confirm-button-minimal interactive-scale" onClick={() => { triggerHaptic('success'); onComplete(); }} style={{ background: '#10B981', color: 'white' }}>FINALIZAR</button>
        )}
      </div>
    </div>
  );
});

export function DriverModeSheet({ session, onActiveRideChange, onLoginRequired }: DriverModeSheetProps) {
  const { showToast } = useToast();
  const [rides, setRides] = useState<APIRide[]>([]);
  const [activeRide, setActiveRide] = useState<APIRide | null>(null);

  useEffect(() => {
    onActiveRideChange?.(!!activeRide);
  }, [activeRide, onActiveRideChange]);
  
  const [isOnline, setIsOnline] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!session) return;
    try {
      const [ridesData, activeRideData] = await Promise.all([
        APIClient.getAvailableRides(),
        APIClient.getActiveRide()
      ]);
      if (ridesData) setRides(ridesData);
      if (activeRideData) setActiveRide(activeRideData);
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
      try {
        const driver = await APIClient.getDriverSetup();
        if (!driver) setNeedsSetup(true);
        else setIsOnline(driver.isActive);
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
    if (!session) {
      onLoginRequired();
      return;
    }
    setLoading(true);
    triggerHaptic('medium');
    try {
      const mappedType = vehicleType === 'skates' ? 'bicycle' : vehicleType;
      await APIClient.setupDriver(mappedType as any);
      setNeedsSetup(false);
      setIsOnline(true);
      showToast('¡Configuración completada!', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error en configuración', 'error');
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
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Error al actualizar estado', 'error');
    }
  }, [activeRide, fetchData, showToast]);

  const handleAcceptRide = useCallback(async (id: string) => {
    triggerHaptic('success');
    try {
      await APIClient.acceptRide(id);
      showToast('Viaje aceptado', 'success');
      fetchData();
    } catch (error: any) {
      showToast(error.message || 'Error al aceptar viaje', 'error');
    }
  }, [fetchData, showToast]);

  const toggleOnline = () => {
    if (!session) {
      onLoginRequired();
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
    <div className="driver-mode-sheet premium-card-anim stagger-in">
      <div className="driver-status-bar" style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
          <button 
              className={`status-toggle-pill interactive-scale ${isOnline ? 'online' : 'offline'}`} 
              onClick={toggleOnline}
          >
            {isOnline ? 'ESTÁS EN LÍNEA 🟢' : 'DESCONECTADO 🔴'}
          </button>
      </div>

      {activeRide ? (
        <div className="active-ride-section">
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>Viaje Activo</h3>
          <RideCard 
            ride={activeRide} 
            onArrive={() => handleUpdateStatus('arrived')}
            onStart={() => handleUpdateStatus('in_progress')} 
            onComplete={() => handleUpdateStatus('completed')} 
          />
        </div>
      ) : (
        <div className="available-rides-section">
          <h3 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '16px' }}>Solicitudes cercanas</h3>
          {!isOnline ? (
            <div className="empty-info" style={{ textAlign: 'center', color: '#6B7280', padding: '40px 0' }}>Conéctate {!session && '(Identifícate primero)'} para empezar a ver solicitudes</div>
          ) : rides.length === 0 ? (
            <div className="empty-info" style={{ textAlign: 'center', color: '#6B7280', padding: '40px 0' }}>Buscando solicitudes...</div>
          ) : (
            <div className="rides-list stagger-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {rides.map(ride => (
                <RideCard key={ride.id} ride={ride} onAccept={handleAcceptRide} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
