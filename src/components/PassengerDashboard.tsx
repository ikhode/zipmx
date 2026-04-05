import { useState, useEffect } from 'react';
import APIClient, { APIRide } from '../lib/api';
import { RideRequest } from './RideRequest';

interface PassengerDashboardProps {
  userId: string;
}

export function PassengerDashboard({ userId }: PassengerDashboardProps) {
  const [rides, setRides] = useState<APIRide[]>([]);
  const [activeRide, setActiveRide] = useState<APIRide | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [userId]);

  const fetchData = () => {
    loadRides();
    loadActiveRide();
  };

  async function loadRides() {
    const data = await APIClient.getMyRides();
    if (data) setRides(data);
    setLoading(false);
  }

  async function loadActiveRide() {
    const data = await APIClient.getMyActiveRide();
    if (data) setActiveRide(data);
  }

  async function cancelRide(rideId: string) {
    const confirmed = confirm('¿Estás seguro de que quieres cancelar este servicio?');
    if (!confirmed) return;

    await APIClient.cancelRide(rideId);
    fetchData();
  }

  function getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      requested: 'Solicitado',
      accepted: 'Aceptado',
      in_progress: 'En Progreso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  }

  function getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      requested: 'status-requested',
      accepted: 'status-accepted',
      in_progress: 'status-progress',
      completed: 'status-completed',
      cancelled: 'status-cancelled',
    };
    return classes[status] || '';
  }

  if (loading) {
    return <div className="loading">Cargando tus viajes...</div>;
  }

  return (
    <div className="passenger-dashboard">
      <h1>Bienvenido a Zipp</h1>

      {activeRide ? (
        <div className="active-ride-section">
          <h2>Servicio Activo</h2>
          <div className="ride-card active">
            <div className="ride-type-badge">
              {activeRide.rideType === 'ride' ? '🚗 Viaje' : '📦 Mandadito'}
            </div>
            <div className="ride-status">
              <span className={`status-badge ${getStatusClass(activeRide.status)}`}>
                {getStatusLabel(activeRide.status)}
              </span>
            </div>
            <div className="ride-details">
              <div className="location">
                <strong>Origen:</strong> {activeRide.pickupAddress}
              </div>
              <div className="location">
                <strong>Destino:</strong> {activeRide.dropoffAddress}
              </div>
              {activeRide.rideType === 'errand' && activeRide.errandDescription && (
                <div className="errand-info">
                  <strong>Descripción:</strong> {activeRide.errandDescription}
                </div>
              )}
              <div className="ride-fare">
                <strong>Tarifa:</strong> ${activeRide.totalFare.toFixed(2)} MXN
              </div>
            </div>
            {activeRide.status === 'requested' && (
              <button
                className="btn-danger"
                onClick={() => cancelRide(activeRide.id)}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <RideRequest
          onRideCreated={() => {
            loadRides();
            loadActiveRide();
          }}
        />
      )}

      <div className="rides-history">
        <h2>Historial</h2>
        {rides.length === 0 ? (
          <div className="empty-state">
            <p>No has solicitado ningún servicio aún</p>
            <p className="help-text">Solicita tu primer viaje o mandadito arriba</p>
          </div>
        ) : (
          <div className="rides-list">
            {rides.map((ride) => (
              <div key={ride.id} className="ride-card">
                <div className="ride-header">
                  <div className="ride-type-badge">
                    {ride.rideType === 'ride' ? '🚗 Viaje' : '📦 Mandadito'}
                  </div>
                  <span className={`status-badge ${getStatusClass(ride.status)}`}>
                    {getStatusLabel(ride.status)}
                  </span>
                </div>
                <div className="ride-details">
                  <div className="location">
                    <strong>Origen:</strong> {ride.pickupAddress}
                  </div>
                  <div className="location">
                    <strong>Destino:</strong> {ride.dropoffAddress}
                  </div>
                  <div className="ride-fare">
                    <strong>Tarifa:</strong> ${ride.totalFare.toFixed(2)} MXN
                  </div>
                  <div className="ride-date">
                    {new Date(ride.createdAt).toLocaleDateString('es-MX', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
