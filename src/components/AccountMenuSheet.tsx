import React from 'react';
import APIClient from '../lib/api';

interface AccountMenuSheetProps {
  session: any;
  currentMode: string;
  hasActiveRide: boolean;
  onSwitchMode: () => void;
  onClose: () => void;
}

export const AccountMenuSheet: React.FC<AccountMenuSheetProps> = ({ session, currentMode, hasActiveRide, onSwitchMode, onClose: _onClose }) => {
  const userName = session?.user?.fullName || 'Usuario';
  
  return (
    <div className="account-menu-sheet fade-in">
      <div className="account-header">
         <h1 className="user-display-name">{userName}</h1>
         <div className="profile-avatar-circle">
           <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
         </div>
      </div>

      <div className="account-action-grid">
        <div className="action-item-box">
          <div className="action-icon">🆘</div>
          <div className="action-label">Ayuda</div>
        </div>
        <div className="action-item-box">
          <div className="action-icon">💳</div>
          <div className="action-label">Wallet</div>
        </div>
        <div className="action-item-box" onClick={() => {}}>
          <div className="action-icon">📅</div>
          <div className="action-label">Actividad</div>
        </div>
      </div>

      <div className="uber-cash-banner">
        <div className="cash-label">Zipp Cash</div>
        <div className="cash-amount">0,00 MXN</div>
      </div>

      <div className="account-links-list">
        <div className="link-item" onClick={onSwitchMode} style={{ opacity: hasActiveRide ? 0.4 : 1 }}>
          <div className="link-icon">{currentMode === 'passenger' ? '👨‍✈️' : '🚗'}</div>
          <div className="link-text">Modo {currentMode === 'passenger' ? 'Conductor' : 'Pasajero'}</div>
        </div>
        <div className="link-item">
          <div className="link-icon">⚙️</div>
          <div className="link-text">Configuración</div>
        </div>
        <div className="link-item">
          <div className="link-icon">🏷️</div>
          <div className="link-text">Promociones</div>
        </div>
      </div>

      <div className="account-footer" style={{ marginTop: 'auto' }}>
        <button className="logout-btn-link" onClick={() => { APIClient.logout(); window.location.reload(); }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
