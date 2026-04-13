import { useState } from 'react';
import APIClient, { APIRide } from '../lib/api';
import { useToast } from './ToastProvider';
import { triggerHaptic } from '../lib/haptics';

interface PostRideSummaryProps {
  ride: APIRide;
  onClose: () => void;
  isDriver?: boolean;
}

export function PostRideSummary({ ride, onClose, isDriver = false }: PostRideSummaryProps) {
  const { showToast } = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      showToast('Por favor selecciona una calificación', 'info');
      return;
    }

    setLoading(true);
    triggerHaptic('medium');
    try {
      const ratedId = isDriver ? ride.passengerId : ride.driverId;
      if (!ratedId) throw new Error('Usuario no encontrado');

      await APIClient.submitRating(ride.id, {
        ratedId,
        rating,
        comment
      });
      
      setSubmitted(true);
      showToast('¡Gracias por tu feedback!', 'success');
      triggerHaptic('success');
      setTimeout(onClose, 2000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar calificación';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="post-ride-summary glass-v2-card fade-in" style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '64px', marginBottom: '16px' }}>✨</div>
        <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '8px' }}>¡Buen Viaje!</h2>
        <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Tus comentarios nos ayudan a mejorar Zipp.</p>
      </div>
    );
  }

  return (
    <div className="post-ride-summary glass-v2-card fade-in" style={{ padding: '32px 24px' }}>
      {!isDriver && (
        <div className="ride-final-summary" style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '4px' }}>Llegaste a tu destino</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontWeight: 600 }}>Esperamos que hayas disfrutado el viaje</p>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '24px' }}>
             <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Costo Final</div>
                <div style={{ fontSize: '20px', fontWeight: 900 }}>${ride.totalFare}</div>
             </div>
             <div style={{ background: 'var(--surface-alt)', padding: '16px', borderRadius: '16px' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>Distancia</div>
                <div style={{ fontSize: '20px', fontWeight: 900 }}>{(ride.distanceKm || 0).toFixed(1)} km</div>
             </div>
          </div>
        </div>
      )}

      {isDriver && (
        <div className="driver-final-summary" style={{ textAlign: 'center', marginBottom: '24px' }}>
           <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Viaje completado</h2>
           <p style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Califica al pasajero para finalizar</p>
        </div>
      )}

      <div className="rating-selector" style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '24px' }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button 
            key={star}
            onClick={() => { setRating(star); triggerHaptic('light'); }}
            style={{ 
              fontSize: '32px', 
              background: 'none', 
              border: 'none', 
              filter: rating >= star ? 'grayscale(0)' : 'grayscale(1)',
              opacity: rating >= star ? 1 : 0.3,
              transition: 'all 0.2s ease'
            }}
          >
            ⭐
          </button>
        ))}
      </div>

      <textarea 
        placeholder="¿Algún comentario adicional? (Opcional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ 
          width: '100%', 
          padding: '16px', 
          borderRadius: '16px', 
          background: 'var(--surface-alt)', 
          border: '1px solid var(--border-light)', 
          fontWeight: 600,
          minHeight: '80px',
          marginBottom: '24px',
          fontFamily: 'inherit'
        }}
      />

      <button 
        className="action-btn-premium complete interactive-scale" 
        onClick={handleSubmit}
        disabled={loading || rating === 0}
        style={{ width: '100%' }}
      >
        {loading ? 'Enviando...' : 'Finalizar y Calificar'}
      </button>
    </div>
  );
}
