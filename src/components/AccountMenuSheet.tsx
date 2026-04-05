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
    <div className="account-menu-sheet fade-in" style={{ padding: '24px' }}>
      <div className="account-header" style={{ marginBottom: '32px' }}>
         <div className="user-info">
           <h1 className="user-display-name" style={{ fontSize: '32px', marginBottom: '4px' }}>{userName}</h1>
           <div className="user-rating" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
             <span>★ 4.98</span>
             <span style={{ opacity: 0.5 }}>•</span>
             <span>Ver perfil</span>
           </div>
         </div>
         <div className="profile-avatar-circle" style={{ width: '56px', height: '56px', background: '#F3F4F6', border: 'none' }}>
           <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
         </div>
      </div>

      <div className="account-action-grid" style={{ marginBottom: '32px' }}>
        <div className="action-item-box">
          <div className="action-icon">🆘</div>
          <div className="action-label">Ayuda</div>
        </div>
        <div className="action-item-box">
          <div className="action-icon">💳</div>
          <div className="action-label">Wallet</div>
        </div>
        <div className="action-item-box">
          <div className="action-icon">📅</div>
          <div className="action-label">Viajes</div>
        </div>
      </div>

      <div className="uber-cash-banner" style={{ background: 'var(--text)', borderRadius: '20px', padding: '20px', marginBottom: '32px' }}>
        <div className="cash-info">
          <div className="cash-label" style={{ opacity: 0.7, fontSize: '12px' }}>Zipp Cash</div>
          <div className="cash-amount" style={{ fontSize: '22px' }}>$0,00</div>
        </div>
        <div className="cash-arrow" style={{ opacity: 0.5 }}>›</div>
      </div>

      <div className="account-links-list">
        <div className="link-item" onClick={onSwitchMode} style={{ opacity: hasActiveRide ? 0.4 : 1, padding: '16px 0' }}>
          <div className="link-icon" style={{ fontSize: '20px' }}>{currentMode === 'passenger' ? '👨‍✈️' : '🚗'}</div>
          <div className="link-text" style={{ flex: 1 }}>Modo {currentMode === 'passenger' ? 'Conductor' : 'Pasajero'}</div>
          <div className="link-arrow" style={{ opacity: 0.3 }}>›</div>
        </div>
        <div className="link-item" style={{ padding: '16px 0' }}>
          <div className="link-icon" style={{ fontSize: '20px' }}>⚙️</div>
          <div className="link-text" style={{ flex: 1 }}>Configuración</div>
          <div className="link-arrow" style={{ opacity: 0.3 }}>›</div>
        </div>
        <div className="link-item" style={{ padding: '16px 0', border: 'none' }}>
          <div className="link-icon" style={{ fontSize: '20px' }}>🏷️</div>
          <div className="link-text" style={{ flex: 1 }}>Ahorra con Zipp PRO</div>
          <div className="link-arrow" style={{ opacity: 0.3 }}>›</div>
        </div>
      </div>

      <div className="account-footer" style={{ marginTop: 'auto', paddingTop: '24px' }}>
        <button className="logout-btn-link" style={{ background: '#F9FAFB', border: '1px solid #F3F4F6', color: '#6B7280' }} onClick={() => { APIClient.logout(); window.location.reload(); }}>
          Cerrar sesión
        </button>
      </div>
    </div>
  );
};
