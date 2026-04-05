import { useState } from 'react';
import APIClient from '../lib/api';

interface Location {
  latitude: number;
  longitude: number;
  address: string;
}

interface RideRequestProps {
  userId: string;
  onRideCreated?: (rideId: string) => void;
}

export function RideRequest({ onRideCreated }: Omit<RideRequestProps, 'userId'>) {
  const [rideType, setRideType] = useState<'ride' | 'errand'>('ride');
  const [pickup, setPickup] = useState<Location>({
    latitude: 0,
    longitude: 0,
    address: '',
  });
  const [dropoff, setDropoff] = useState<Location>({
    latitude: 0,
    longitude: 0,
    address: '',
  });
  const [errandDescription, setErrandDescription] = useState('');
  const [errandItems, setErrandItems] = useState('');
  const [loading, setLoading] = useState(false);

  async function estimateFare(distanceKm: number, durationMin: number, rideType: 'ride' | 'errand'): Promise<number> {
    // New platform defaults matching the suggested ranges
    const baseFare = rideType === 'ride' ? 25 : 30;
    const perKm = rideType === 'ride' ? 10 : 12;
    const perMin = rideType === 'ride' ? 2 : 2.5;
    
    return baseFare + (distanceKm * perKm) + (durationMin * perMin);
  }

  function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function requestRide() {
    if (!pickup.address || !dropoff.address) {
      alert('Por favor ingresa las direcciones de origen y destino');
      return;
    }

    if (rideType === 'errand' && !errandDescription) {
      alert('Por favor describe el mandadito que necesitas');
      return;
    }

    try {
      setLoading(true);

      const distanceKm = calculateDistance(
        pickup.latitude,
        pickup.longitude,
        dropoff.latitude,
        dropoff.longitude
      );

      const estimatedMinutes = Math.ceil((distanceKm / 30) * 60) + 2; // +2 for buffer
      const totalFare = await estimateFare(distanceKm, estimatedMinutes, rideType);

      const data = await APIClient.requestRide({
        pickup: { lat: pickup.latitude, lng: pickup.longitude, address: pickup.address },
        dropoff: { lat: dropoff.latitude, lng: dropoff.longitude, address: dropoff.address },
        type: rideType,
        price: totalFare,
        distance: distanceKm,
        duration: estimatedMinutes,
        description: errandDescription,
        items: errandItems,
      });

      alert(`${rideType === 'ride' ? 'Viaje' : 'Mandadito'} solicitado exitosamente!`);

      if (onRideCreated && data) {
        onRideCreated(data.id);
      }

      setPickup({ latitude: 0, longitude: 0, address: '' });
      setDropoff({ latitude: 0, longitude: 0, address: '' });
      setErrandDescription('');
      setErrandItems('');
    } catch (error) {
      console.error('Error requesting ride:', error);
      alert('Error al solicitar el servicio. Por favor intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  function getCurrentLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPickup({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            address: 'Ubicación actual',
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          alert('No se pudo obtener tu ubicación. Por favor ingrésala manualmente.');
        }
      );
    }
  }

  return (
    <div className="ride-request">
      <div className="service-type-selector">
        <button
          className={`service-type-btn ${rideType === 'ride' ? 'active' : ''}`}
          onClick={() => setRideType('ride')}
          data-testid="ride-type-btn"
        >
          <span className="icon">🚗</span>
          <span className="label">Viaje</span>
        </button>
        <button
          className={`service-type-btn ${rideType === 'errand' ? 'active' : ''}`}
          onClick={() => setRideType('errand')}
          data-testid="errand-type-btn"
        >
          <span className="icon">📦</span>
          <span className="label">Mandadito</span>
        </button>
      </div>

      <div className="form-section">
        <h3>{rideType === 'ride' ? 'Solicitar Viaje' : 'Solicitar Mandadito'}</h3>

        <div className="location-inputs">
          <div className="input-group">
            <label>Origen</label>
            <div className="input-with-button">
              <input
                type="text"
                placeholder="Dirección de origen"
                value={pickup.address}
                onChange={(e) => setPickup({ ...pickup, address: e.target.value })}
              />
              <button className="btn-icon" onClick={getCurrentLocation} title="Usar ubicación actual">
                📍
              </button>
            </div>
          </div>

          <div className="input-group">
            <label>Destino</label>
            <input
              type="text"
              placeholder="Dirección de destino"
              value={dropoff.address}
              onChange={(e) => setDropoff({ ...dropoff, address: e.target.value })}
            />
          </div>
        </div>

        {rideType === 'errand' && (
          <div className="errand-details">
            <div className="input-group">
              <label>Descripción del Mandadito</label>
              <textarea
                placeholder="¿Qué necesitas que hagamos?"
                value={errandDescription}
                onChange={(e) => setErrandDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="input-group">
              <label>Artículos (opcional)</label>
              <input
                type="text"
                placeholder="Ej: 1 pastel, 2 cajas pequeñas"
                value={errandItems}
                onChange={(e) => setErrandItems(e.target.value)}
              />
            </div>
          </div>
        )}

        <button
          className="btn-primary btn-large"
          onClick={requestRide}
          disabled={loading}
          data-testid="submit-request-btn"
        >
          {loading ? 'Solicitando...' : `Solicitar ${rideType === 'ride' ? 'Viaje' : 'Mandadito'}`}
        </button>
      </div>

      <div className="info-section">
        <h4>Transparencia de Tarifas</h4>
        <div className="pricing-info-premium card-inner-glass p-4 mt-2">
          {rideType === 'ride' ? (
            <div className="breakdown-grid text-sm opacity-90">
              <div className="breakdown-item flex justify-between mb-1">
                <span>Base (Viaje corto inicial):</span>
                <strong>$25.00 MXN</strong>
              </div>
              <div className="breakdown-item flex justify-between mb-1">
                <span>Por Kilómetro:</span>
                <strong>$10.00 MXN</strong>
              </div>
              <div className="breakdown-item flex justify-between">
                <span>Tiempo de Espera:</span>
                <strong>$2.00 MXN/min</strong>
              </div>
            </div>
          ) : (
            <div className="breakdown-grid text-sm opacity-90">
              <div className="breakdown-item flex justify-between mb-1">
                <span>Base (Encargo inicial):</span>
                <strong>$30.00 MXN</strong>
              </div>
              <div className="breakdown-item flex justify-between mb-1">
                <span>Por Kilómetro:</span>
                <strong>$12.00 MXN</strong>
              </div>
              <div className="breakdown-item flex justify-between mb-1">
                <span>Gestión y Espera:</span>
                <strong>$2.50 MXN/min</strong>
              </div>
              <p className="note text-[10px] mt-2 opacity-60">Los mandaditos incluyen gestión personalizada del encargo.</p>
            </div>
          )}
          <p className="transparency-label mt-4 text-[10px] text-accent uppercase font-bold tracking-wider">
            Tarifa Transparente Zipp - Sin Sorpresas
          </p>
        </div>
      </div>
    </div>
  );
}
