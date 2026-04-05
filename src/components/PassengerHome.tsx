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
      {/* Search Bar - Minimalist Uber Style */}
      <div className="minimal-search-box">
        <div className="search-input-group" onClick={() => onStartPlanning('dropoff')}>
          <div className="search-indicator">
            <div className="dot-minimal dest"></div>
          </div>
          <div className="search-text-minimal">
            {dropoffAddress || '¿A dónde vamos?'}
          </div>
        </div>
      </div>

      {/* Quick Filters Row */}
      <div className="quick-access-row">
        <div className="quick-pill" onClick={() => onStartPlanning('pickup')}>
           <span className="pill-icon">📍</span>
           <span>Actual</span>
        </div>
        <div className="quick-pill">
           <span className="pill-icon">🕒</span>
           <span>Ahora</span>
        </div>
        <div className="quick-pill">
           <span className="pill-icon">👤</span>
           <span>Para mí</span>
        </div>
      </div>

      {/* Promo - Subtle & Elegant */}
      <div className="minimal-promo" onClick={onPromoClick}>
        <div className="promo-tag-mini">40% OFF</div>
        <div className="promo-text-mini">Ahorra en tu próximo viaje zipp</div>
        <div className="promo-arrow-mini">›</div>
      </div>

      {/* Suggestions - Breathable Grid */}
      <div className="suggestions-minimal">
        <h3 className="section-subtitle">Sugerencias</h3>
        <div className="minimal-grid">
          {[
            { id: 'taxi', name: 'Taxi', icon: '🚕', gradient: 'taxi-minimal' },
            { id: 'mototaxi', name: 'Moto', icon: '🏍️', gradient: 'moto-minimal' },
            { id: 'errand', name: 'Envío', icon: '📦', gradient: 'errand-minimal' }
          ].map(s => (
            <div key={s.id} className="minimal-card" onClick={() => onSelectService(s.id as any)}>
              <div className={`minimal-icon-box ${s.gradient}`}>
                <span className="emoji-icon">{s.icon}</span>
              </div>
              <span className="minimal-label">{s.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
