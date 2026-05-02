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
  const [hoverRating, setHoverRating] = useState(0);

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
      showToast('¡Gracias por tu calificación!', 'success');
      triggerHaptic('success');
      setTimeout(onClose, 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error al enviar calificación';
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="post-ride-summary glass-v2-card fade-in" style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--bg-card)' }}>
        <div style={{ position: 'relative', display: 'inline-block', marginBottom: '24px' }}>
          <div className="success-pulse" style={{ position: 'absolute', inset: -20, background: 'rgba(16, 185, 129, 0.2)', borderRadius: '50%', animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite' }}></div>
          <div style={{ fontSize: '80px' }}>✨</div>
        </div>
        <h2 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '12px', letterSpacing: '-0.02em' }}>¡Gracias por tu apoyo!</h2>
        <p style={{ color: 'var(--text-muted)', fontWeight: 600, fontSize: '16px', lineHeight: 1.5, maxWidth: '280px', margin: '0 auto' }}>
          Tu retroalimentación nos ayuda a construir la mejor comunidad de movilidad.
        </p>
      </div>
    );
  }

  return (
    <div className="post-ride-summary glass-v2-card fade-in" style={{ padding: '32px 24px', borderRadius: '32px' }}>
      <div className="ride-final-summary" style={{ textAlign: 'center', marginBottom: '40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏁</div>
        <h2 style={{ fontSize: '26px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-1px' }}>
          {isDriver ? '¡Viaje Terminado!' : 'Llegaste a tu destino'}
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', fontWeight: 600 }}>
          {isDriver ? '¿Cómo calificarías al pasajero?' : '¿Cómo estuvo tu viaje?'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '32px' }}>
          <div style={{ background: 'var(--surface-alt)', padding: '20px 16px', borderRadius: '24px', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Costo</div>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px' }}>${ride.totalFare}</div>
          </div>
          <div style={{ background: 'var(--surface-alt)', padding: '20px 16px', borderRadius: '24px', border: '1px solid var(--border-light)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>Distancia</div>
            <div style={{ fontSize: '22px', fontWeight: 900, letterSpacing: '-0.5px' }}>{(ride.distanceKm || 0).toFixed(1)} <span style={{ fontSize: '14px', fontWeight: 700 }}>km</span></div>
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--surface-alt)', padding: '32px 24px', borderRadius: '28px', border: '1px solid var(--border-light)', marginBottom: '24px' }}>
        <div className="rating-selector" style={{ display: 'flex', justifyContent: 'center', gap: '14px', marginBottom: '32px' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button 
              key={star}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => { setRating(star); triggerHaptic('medium'); }}
              style={{ 
                fontSize: '38px', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                filter: (hoverRating || rating) >= star ? 'grayscale(0) drop-shadow(0 0 10px rgba(252, 211, 77, 0.4))' : 'grayscale(1)',
                opacity: (hoverRating || rating) >= star ? 1 : 0.2,
                transform: (hoverRating || rating) >= star ? 'scale(1.15)' : 'scale(1)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              ⭐
            </button>
          ))}
        </div>

        <textarea 
          placeholder="Escribe un comentario opcional..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '18px', 
            borderRadius: '20px', 
            background: 'var(--bg-main, #fff)', 
            border: '1px solid var(--border-light)', 
            fontWeight: 600,
            fontSize: '15px',
            minHeight: '100px',
            fontFamily: 'inherit',
            outline: 'none',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
            transition: 'border-color 0.3s ease'
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--text)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border-light)')}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button 
          className="interactive-scale"
          onClick={onClose}
          style={{ 
            flex: 1, 
            padding: '18px', 
            borderRadius: '20px', 
            background: '#F3F4F6', 
            border: 'none', 
            fontWeight: 800, 
            color: '#64748B',
            fontSize: '15px'
          }}
        >
          Omitir
        </button>
        <button 
          className="action-btn-premium complete interactive-scale" 
          onClick={handleSubmit}
          disabled={loading || rating === 0}
          style={{ 
            flex: 2, 
            background: rating > 0 ? 'var(--text)' : '#9CA3AF',
            color: 'white',
            borderRadius: '20px',
            fontWeight: 900,
            fontSize: '15px',
            boxShadow: rating > 0 ? '0 10px 20px rgba(0,0,0,0.15)' : 'none'
          }}
        >
          {loading ? 'Enviando...' : 'Calificar'}
        </button>
      </div>
    </div>
  );
}
