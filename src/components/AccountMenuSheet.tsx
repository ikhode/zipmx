import React, { useState, useMemo } from 'react';
import APIClient from '../lib/api';
import { triggerHaptic } from '../lib/haptics';
import { useToast } from './ToastProvider';

interface AccountMenuSheetProps {
  session: any;
  currentMode: string;
  hasActiveRide: boolean;
  onSwitchMode: () => void;
  onClose: () => void;
}

type ViewType = 'menu' | 'wallet' | 'trips' | 'help' | 'settings' | 'zipp-pro';

const renderSubViewHeader = (title: string, onBack: () => void) => (
  <div className="sub-view-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
    <button onClick={onBack} className="back-btn-minimal" style={{ fontSize: '24px', padding: '8px' }}>←</button>
    <h2 style={{ fontSize: '20px', fontWeight: 900 }}>{title}</h2>
  </div>
);

// --- Stable Sub-View Components (Defined OUTSIDE to prevent remounting/flicker) ---

const WalletView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="wallet-view fade-in">
    {renderSubViewHeader('Billetera', onBack)}
    <div className="premium-card-wallet" style={{ background: 'var(--text)', color: 'white', borderRadius: '24px', padding: '32px', marginBottom: '32px', boxShadow: 'var(--shadow-premium)' }}>
      <div style={{ opacity: 0.7, fontSize: '14px', marginBottom: '8px' }}>Saldo disponible</div>
      <div style={{ fontSize: '42px', fontWeight: 900 }}>$0.00</div>
    </div>
    <div className="wallet-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
       <button className="wallet-btn" style={{ background: '#F3F4F6', padding: '20px', borderRadius: '16px', fontWeight: 700 }}>
          <span style={{ display: 'block', fontSize: '20px', marginBottom: '4px' }}>💳</span>
          Añadir fondos
       </button>
       <button className="wallet-btn" style={{ background: '#F3F4F6', padding: '20px', borderRadius: '16px', fontWeight: 700 }}>
          <span style={{ display: 'block', fontSize: '20px', marginBottom: '4px' }}>💸</span>
          Retirar
       </button>
    </div>
    <h3 style={{ fontSize: '16px', fontWeight: 800, marginBottom: '16px' }}>Actividad reciente</h3>
    <div style={{ opacity: 0.5, textAlign: 'center', padding: '40px 0' }}>No hay transacciones recientes</div>
  </div>
);

const TripsView: React.FC<{ onBack: () => void, onClose: () => void }> = ({ onBack, onClose }) => (
  <div className="trips-view fade-in">
    {renderSubViewHeader('Tus Viajes', onBack)}
    <div className="trips-tabs" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #EEE', marginBottom: '24px' }}>
       <div style={{ paddingBottom: '12px', borderBottom: '2px solid black', fontWeight: 800 }}>Pasados</div>
       <div style={{ paddingBottom: '12px', opacity: 0.5, fontWeight: 700 }}>Programados</div>
    </div>
    <div style={{ padding: '60px 20px', textAlign: 'center' }}>
       <div style={{ fontSize: '40px', marginBottom: '16px' }}>🚗</div>
       <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Aún no has realizado ningún viaje con ZIPP</p>
       <button onClick={onClose} style={{ marginTop: '24px', background: 'var(--text)', color: 'white', padding: '12px 24px', borderRadius: '100px', fontWeight: 800 }}>Pide uno ahora</button>
    </div>
  </div>
);

const HelpView: React.FC<{ onBack: () => void, onAction: (v: ViewType) => void }> = ({ onBack, onAction }) => {
  const { showToast } = useToast();

  const handleSOS = () => {
    triggerHaptic('error');
    if (confirm('¿Deseas llamar a servicios de emergencia (911)?')) {
      window.open('tel:911');
    }
  };

  const handleSupport = () => {
    triggerHaptic('medium');
    window.open('https://wa.me/5211234567890?text=Hola,%20necesito%20ayuda%20con%20ZIPP');
  };

  const handleClick = (id: string) => {
    triggerHaptic('light');
    switch (id) {
      case 'trip':
        showToast('Cargando tus viajes recientes...', 'info');
        setTimeout(() => onAction('trips'), 1000);
        break;
      case 'safety':
        showToast('Abriendo guía de seguridad interactiva...', 'info');
        window.open('https://zipp.pages.dev/safety'); // Simulated URL
        break;
      case 'lost':
        window.open('https://wa.me/5211234567890?text=Hola,%20perdí%20un%20objeto%20en%20mi%20último%20vuelo%20con%20ZIPP');
        break;
      default:
        break;
    }
  };

  const categories = [
    { id: 'trip', title: 'Problemas con un viaje', icon: '🚗', color: '#E0F2FE' },
    { id: 'safety', title: 'Guía de seguridad', icon: '🛡️', color: '#FEF9C3' },
    { id: 'lost', title: 'Objeto perdido', icon: '🎧', color: '#F3E8FF' }
  ];

  return (
    <div className="help-view fade-in">
      {renderSubViewHeader('Ayuda', onBack)}
      
      <div className="help-sos-card stagger-in" onClick={handleSOS}>
        <div className="sos-info">
          <h3>Seguridad SOS</h3>
          <p>Asistencia inmediata en caso de emergencia</p>
        </div>
        <button className="sos-btn-pulse active-scale">🚨</button>
      </div>

      <div className="help-category-grid">
        {categories.map((cat, i) => (
          <div key={cat.id} className="category-card-premium stagger-in" style={{ animationDelay: `${i * 0.1}s` }} onClick={() => handleClick(cat.id)}>
            <div className="cat-icon-box" style={{ background: cat.color }}>{cat.icon}</div>
            <div className="cat-title">{cat.title}</div>
          </div>
        ))}
      </div>

      <div className="support-action-footer stagger-in">
        <button className="btn-premium-support interactive-scale" onClick={handleSupport}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 1 1-7.6-11.7 8.5 8.5 0 0 1 2.3 0z"></path><path d="M21 3L14.5 9.5"></path><path d="M15.5 3H21v5.5"></path></svg>
          Contactar Soporte
        </button>
      </div>
    </div>
  );
};

const MainMenuView: React.FC<{ 
  userName: string, 
  currentMode: string, 
  hasActiveRide: boolean, 
  onAction: (v: ViewType) => void, 
  onSwitchMode: () => void 
}> = ({ userName, currentMode, hasActiveRide, onAction, onSwitchMode }) => (
  <div className="main-menu-view fade-in">
    <div className="account-header" style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="user-info">
          <h1 className="user-display-name" style={{ fontSize: '32px', fontWeight: 900, marginBottom: '4px', letterSpacing: '-0.02em' }}>{userName}</h1>
          <div className="user-rating" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', fontWeight: 800, color: 'var(--text-muted)' }}>
            <span style={{ color: '#000', display: 'flex', alignItems: 'center', gap: '2px' }}>★ 4.98</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span style={{ color: 'var(--text)', cursor: 'pointer' }}>Ver detalles</span>
          </div>
        </div>
        <div className="profile-avatar-premium" style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#F3F4F6', border: '2px solid white', boxShadow: 'var(--shadow-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
        </div>
    </div>

    <div className="account-action-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '32px' }}>
      <div className="action-item-premium interactive-scale" onClick={() => onAction('help')} style={{ background: '#F8FAFC', padding: '16px 8px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer' }}>
        <div className="action-icon" style={{ fontSize: '24px', marginBottom: '8px' }}>🆘</div>
        <div className="action-label" style={{ fontSize: '13px', fontWeight: 800 }}>Ayuda</div>
      </div>
      <div className="action-item-premium interactive-scale" onClick={() => onAction('wallet')} style={{ background: '#F8FAFC', padding: '16px 8px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer' }}>
        <div className="action-icon" style={{ fontSize: '24px', marginBottom: '8px' }}>💳</div>
        <div className="action-label" style={{ fontSize: '13px', fontWeight: 800 }}>Wallet</div>
      </div>
      <div className="action-item-premium interactive-scale" onClick={() => onAction('trips')} style={{ background: '#F8FAFC', padding: '16px 8px', borderRadius: '20px', textAlign: 'center', cursor: 'pointer' }}>
        <div className="action-icon" style={{ fontSize: '24px', marginBottom: '8px' }}>📅</div>
        <div className="action-label" style={{ fontSize: '13px', fontWeight: 800 }}>Viajes</div>
      </div>
    </div>

    <div className="zipp-cash-premium interactive-scale" onClick={() => onAction('wallet')} style={{ background: 'linear-gradient(135deg, #000 0%, #333 100%)', borderRadius: '24px', padding: '24px', marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'white', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}>
      <div className="cash-info">
        <div className="cash-label" style={{ opacity: 0.7, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 800, marginBottom: '4px' }}>Zipp Cash</div>
        <div className="cash-amount" style={{ fontSize: '26px', fontWeight: 900 }}>$0.00</div>
      </div>
      <div className="cash-arrow-premium" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</div>
    </div>

    <div className="account-links-premium">
      <div className="link-item-premium interactive-scale" onClick={onSwitchMode} style={{ display: 'flex', alignItems: 'center', padding: '18px 0', borderBottom: '1px solid #F3F4F6', opacity: hasActiveRide ? 0.4 : 1, cursor: 'pointer' }}>
        <div className="link-icon-bg" style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', fontSize: '20px' }}>
          {currentMode === 'passenger' ? '👨‍✈️' : '🚗'}
        </div>
        <div className="link-text" style={{ flex: 1, fontWeight: 700, fontSize: '16px' }}>Modo {currentMode === 'passenger' ? 'Conductor' : 'Pasajero'}</div>
        <div className="link-arrow" style={{ opacity: 0.3 }}>›</div>
      </div>
      <div className="link-item-premium interactive-scale" onClick={() => onAction('settings')} style={{ display: 'flex', alignItems: 'center', padding: '18px 0', borderBottom: '1px solid #F3F4F6', cursor: 'pointer' }}>
        <div className="link-icon-bg" style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', fontSize: '20px' }}>⚙️</div>
        <div className="link-text" style={{ flex: 1, fontWeight: 700, fontSize: '16px' }}>Configuración</div>
        <div className="link-arrow" style={{ opacity: 0.3 }}>›</div>
      </div>
      <div className="link-item-premium interactive-scale" onClick={() => onAction('zipp-pro')} style={{ display: 'flex', alignItems: 'center', padding: '18px 0', cursor: 'pointer' }}>
        <div className="link-icon-bg" style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '16px', fontSize: '20px' }}>🏷️</div>
        <div className="link-text" style={{ flex: 1, fontWeight: 700, fontSize: '16px' }}>Ahorra con Zipp PRO</div>
        <div className="link-arrow" style={{ opacity: 0.3 }}>›</div>
      </div>
    </div>

    <div className="account-footer-premium" style={{ marginTop: 'auto', paddingTop: '32px' }}>
      <button 
        className="logout-btn-premium active-scale" 
        style={{ width: '100%', background: '#F9FAFB', border: '1px solid #F3F4F6', color: '#EF4444', padding: '16px', borderRadius: '16px', fontWeight: 800, fontSize: '15px' }} 
        onClick={() => { 
          triggerHaptic('medium');
          APIClient.logout(); 
          window.location.reload(); 
        }}
      >
        Cerrar sesión
      </button>
    </div>
  </div>
);

// --- MAIN WRAPPER COMPONENT ---

export const AccountMenuSheet: React.FC<AccountMenuSheetProps> = ({ session, currentMode, hasActiveRide, onSwitchMode, onClose }) => {
  const [view, setView] = useState<ViewType>('menu');
  const userName = session?.user?.fullName || 'Invitado';

  const handleAction = (newView: ViewType) => {
    triggerHaptic('light');
    setView(newView);
  };

  const handleBack = () => {
    triggerHaptic('light');
    setView('menu');
  };

  // We memoize current sub-view to prevent internal re-computations if props didn't change
  const currentView = useMemo(() => {
    switch (view) {
      case 'menu':
        return <MainMenuView 
                  userName={userName} 
                  currentMode={currentMode} 
                  hasActiveRide={hasActiveRide} 
                  onAction={handleAction} 
                  onSwitchMode={onSwitchMode} 
                />;
      case 'wallet':
        return <WalletView onBack={handleBack} />;
      case 'trips':
        return <TripsView onBack={handleBack} onClose={onClose} />;
      case 'help':
        return <HelpView onBack={handleBack} onAction={handleAction} />;
      case 'settings':
        return (
          <div className="fade-in">
            {renderSubViewHeader('Configuración', handleBack)}
            <p style={{ opacity: 0.5, textAlign: 'center', padding: '40px' }}>Opciones de cuenta en desarrollo</p>
          </div>
        );
      case 'zipp-pro':
        return (
          <div className="fade-in">
            {renderSubViewHeader('Zipp PRO', handleBack)}
            <div style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)', padding: '32px', borderRadius: '24px', color: 'white', textAlign: 'center' }}>
              <h3 style={{ fontSize: '24px', fontWeight: 900, marginBottom: '12px' }}>Próximamente</h3>
              <p>Obtén beneficios exclusivos y ahorra en cada viaje.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  }, [view, userName, currentMode, hasActiveRide, onSwitchMode, onClose]);

  return (
    <div className="account-menu-sheet-container" style={{ padding: '24px', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
       {currentView}
    </div>
  );
};
