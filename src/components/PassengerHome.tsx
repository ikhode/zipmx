import React from 'react';
import { triggerHaptic } from '../lib/haptics';

interface PassengerHomeProps {
  dropoffAddress: string;
  onStartPlanning: (field: 'pickup' | 'dropoff') => void;
  onSelectService: (type: 'ride' | 'errand' | 'taxi' | 'mototaxi') => void;
  onPromoClick: () => void;
}

export const PassengerHome: React.FC<PassengerHomeProps> = ({
  dropoffAddress,
  onStartPlanning,
  onSelectService,
  onPromoClick
}) => {
  const handleAction = (cb: () => void, haptic: any = 'light') => {
    triggerHaptic(haptic);
    cb();
  };

  return (
    <div className="passenger-home fade-in stagger-in">
      <h1 className="section-subtitle" style={{ fontSize: '36px', marginBottom: '24px', marginTop: '8px', color: 'var(--text)', letterSpacing: '-0.04em', fontWeight: 900, lineHeight: 1.1 }}>¿A dónde vamos?</h1>
      
      {/* Search Bar - High Fidelity */}
      <div 
        className="premium-search-box interactive-scale" 
        onClick={() => handleAction(() => onStartPlanning('dropoff'), 'medium')}
      >
        <div className="search-input-group">
          <div className="search-icon-premium">
            <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.3-4.3" strokeLinecap="round"></path></svg>
          </div>
          <div className="search-text-premium">
            {dropoffAddress || '¿Hacia dónde vas?'}
          </div>
        </div>
      </div>

      {/* Quick Filters Row - Refined */}
      <div className="quick-access-row">
        <div className="quick-pill interactive-scale" onClick={() => handleAction(() => onStartPlanning('pickup'))}>
           <span className="pill-icon">📍</span>
           <span>Actual</span>
        </div>
        <div className="quick-pill interactive-scale" onClick={() => triggerHaptic('light')}>
           <span className="pill-icon">🕒</span>
           <span>Ahora</span>
        </div>
      </div>

      {/* Suggestions - Premium Grid */}
      <div className="suggestions-minimal">
        <div className="premium-grid">
          {[
            { id: 'ride', name: 'Viaje', icon: '🚗', gradient: 'taxi-premium' },
            { id: 'mototaxi', name: 'Zipp Moto', icon: '🏍️', gradient: 'moto-premium' },
            { id: 'errand', name: 'Zipp Envío', icon: '📦', gradient: 'errand-premium' }
          ].map(s => (
            <div 
              key={s.id} 
              className="premium-card interactive-scale" 
              onClick={() => handleAction(() => onSelectService(s.id as any), 'medium')}
            >
              <div className={`premium-icon-box ${s.gradient}`}>
                <span className="emoji-icon" style={{ fontSize: '42px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.15))' }}>{s.icon}</span>
              </div>
              <span className="premium-label">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Promo - Floating style */}
      <div 
        className="premium-promo-card interactive-scale" 
        onClick={() => handleAction(onPromoClick, 'medium')} 
        style={{ marginTop: '32px' }}
      >
        <div className="promo-content">
          <div className="promo-tag-neon">ZIPP PRO</div>
          <div className="promo-text-light">Desbloquea viajes con un 40% de descuento</div>
        </div>
        <div className="promo-arrow-pulse">›</div>
      </div>
    </div>
  );
};
