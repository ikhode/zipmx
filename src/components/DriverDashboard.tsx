import React, { useState, useEffect, useCallback } from 'react';
import APIClient, { APIRide } from '../lib/api';
import { DriverCommissionTracker } from './DriverCommissionTracker';
import { DriverFareSettings } from './DriverFareSettings';
import { useToast } from './ToastProvider';


interface DriverDashboardProps {
  driverId: string;
}

const RideCard = React.memo(({ ride, onAccept, onStart, onComplete, isBlocked }: any) => {
  const isAvailable = !onStart && !onComplete;
  const isActive = !!onStart || !!onComplete;

  return (
    <div className={`ride-card ${isActive ? 'active' : ''}`}>
      <div className="ride-type-badge">
        {ride.rideType === 'ride' ? '🚗 Viaje' : '📦 Mandadito'}
      </div>
      <div className="ride-details">
        <div className="location"><strong>Origen:</strong> {ride.pickupAddress}</div>
        <div className="location"><strong>Destino:</strong> {ride.dropoffAddress}</div>
        {ride.rideType === 'errand' && ride.errandDescription && (
          <div className="errand-info"><strong>Descripción:</strong> {ride.errandDescription}</div>
        )}
        <div className="ride-fare"><strong>Tarifa:</strong> ${ride.totalFare?.toFixed(2)} MXN</div>
        {ride.distanceKm && <div className="ride-distance"><strong>Distancia:</strong> {ride.distanceKm.toFixed(2)} km</div>}
      </div>
      <div className="ride-actions">
        {isAvailable && (
          <button className="btn-primary" onClick={() => onAccept(ride.id)} disabled={isBlocked}>
            Aceptar
          </button>
        )}
        {ride.status === 'accepted' && (
          <button className="btn-primary" onClick={onStart}>Iniciar Viaje</button>
        )}
        {ride.status === 'in_progress' && (
          <button className="btn-success" onClick={onComplete}>Completar Viaje</button>
        )}
      </div>
    </div>
  );
});

export function DriverDashboard({ driverId }: DriverDashboardProps) {
  const { showToast } = useToast();
  const [driver, setDriver] = useState<any | null>(null);

  const [availableRides, setAvailableRides] = useState<APIRide[]>([]);
  const [activeRide, setActiveRide] = useState<APIRide | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [driverData, ridesData, activeRideData] = await Promise.all([
        APIClient.getDriverSetup(),
        APIClient.getAvailableRides(),
        APIClient.getActiveRide()
      ]);
      
      if (driverData) {
        setDriver(driverData);
        setIsOnline(driverData.isActive);
      }
      if (ridesData) setAvailableRides(ridesData);
      if (activeRideData) setActiveRide(activeRideData);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000); // Relaxed polling
    return () => clearInterval(interval);
  }, [fetchData]);

  const toggleOnlineStatus = async () => {
    if (!driver) return;
    if (driver.isBlocked) {
      showToast('Cuenta bloqueada. Favor de liquidar comisiones.', 'error');
      return;
    }
    setIsOnline(!isOnline);
    // Ideally call API here: await APIClient.updateDriverStatus(!isOnline);
  };

  const handleAcceptRide = async (rideId: string) => {
    if (driver?.isBlocked) return;
    try {
      await APIClient.acceptRide(rideId);
      fetchData();
    } catch (error: any) {
      showToast(error.message, 'error');
    }
  };

  const handleStartRide = async () => {
    if (!activeRide) return;
    await APIClient.updateRideStatus(activeRide.id, 'in_progress');
    fetchData();
  };

  const handleCompleteRide = async () => {
    if (!activeRide) return;
    await APIClient.updateRideStatus(activeRide.id, 'completed');
    showToast('¡Viaje completado!', 'success');
    fetchData();
  };

  if (loading) return <div className="loading">Cargando...</div>;
  if (!driver) return <div className="error">No se encontró información</div>;

  return (
    <div className="driver-dashboard">
      <div className="dashboard-header">
        <h1>Panel del Conductor</h1>
        <button
          className={`status-toggle ${isOnline ? 'online' : 'offline'} ${driver.isBlocked ? 'blocked' : ''}`}
          onClick={toggleOnlineStatus}
          disabled={driver.isBlocked}
        >
          {driver.isBlocked ? 'Bloqueado' : isOnline ? 'En Línea' : 'Desconectado'}
        </button>
      </div>

      {driver.isBlocked && (
        <div className="alert alert-danger">
          Cuenta bloqueada (${driver.unpaidCommissionAmount.toFixed(2)} MXN pendientes).
        </div>
      )}

      {!activeRide && <DriverFareSettings />}

      <DriverCommissionTracker driverId={driverId} />

      {activeRide ? (
        <div className="active-ride-section">
          <h2>Viaje Activo</h2>
          <RideCard 
            ride={activeRide} 
            onStart={handleStartRide} 
            onComplete={handleCompleteRide} 
          />
        </div>
      ) : (
        <div className="available-rides-section">
          <h2>Viajes Disponibles</h2>
          {!isOnline ? (
            <div className="info-message">Conéctate para ver viajes</div>
          ) : availableRides.length === 0 ? (
            <div className="empty-state">Buscando viajes...</div>
          ) : (
            <div className="rides-list">
              {availableRides.map((ride) => (
                <RideCard 
                  key={ride.id} 
                  ride={ride} 
                  onAccept={handleAcceptRide} 
                  isBlocked={driver.isBlocked} 
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
