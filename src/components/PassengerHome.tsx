import React from 'react';

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
  return (
    <div className="passenger-home fade-in">
      <h1 className="section-subtitle" style={{ fontSize: '34px', marginBottom: '32px', color: 'var(--text)' }}>¿A dónde vamos?</h1>
      
      {/* Search Bar - High Fidelity */}
      <div className="minimal-search-box" onClick={() => onStartPlanning('dropoff')}>
        <div className="search-input-group">
          <div className="dot-minimal dest" style={{ backgroundColor: 'black', borderRadius: '2px' }}></div>
          <div className="search-text-minimal">
            {dropoffAddress || 'Calle, Número, Colonia...'}
          </div>
        </div>
      </div>

      {/* Quick Filters Row - Refined */}
      <div className="quick-access-row">
        <div className="quick-pill" onClick={() => onStartPlanning('pickup')}>
           <span className="pill-icon">📍</span>
           <span>Actual</span>
        </div>
        <div className="quick-pill">
           <span className="pill-icon">🕒</span>
           <span>Ahora</span>
        </div>
      </div>

      {/* Suggestions - Premium Grid */}
      <div className="suggestions-minimal">
        <div className="minimal-grid">
          {[
            { id: 'ride', name: 'Viaje', icon: '🚗', gradient: 'taxi-minimal' },
            { id: 'mototaxi', name: 'Zipp Moto', icon: '🏍️', gradient: 'moto-minimal' },
            { id: 'errand', name: 'Zipp Envío', icon: '📦', gradient: 'errand-minimal' }
          ].map(s => (
            <div key={s.id} className="minimal-card" onClick={() => onSelectService(s.id as any)}>
              <div className={`minimal-icon-box ${s.gradient}`}>
                <span className="emoji-icon" style={{ fontSize: '38px' }}>{s.icon}</span>
              </div>
              <span className="minimal-label">{s.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Promo - Floating style */}
      <div className="minimal-promo" onClick={onPromoClick} style={{ marginTop: '32px' }}>
        <div className="promo-tag-mini">Zipp PRO</div>
        <div className="promo-text-mini">Desbloquea viajes con un 40% de descuento</div>
        <div className="promo-arrow-mini">›</div>
      </div>
    </div>
  );
};
