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
  onVerifyIdentity?: () => void;
  onUserUpdate?: (user: any) => void;
}

type ViewType = 'menu' | 'wallet' | 'trips' | 'help' | 'settings' | 'zipp-pro' | 'safety';

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

const SettingsView: React.FC<{ session: any, onBack: () => void, onVerify?: () => void, onUserUpdate?: (user: any) => void }> = ({ session, onBack, onVerify, onUserUpdate }) => {
  const user = session?.user;
  const { showToast } = useToast();
  
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (field: string, value: string) => {
    triggerHaptic('light');
    setEditingField(field);
    setEditValue(value);
  };

  const handleSave = async () => {
    if (!editingField) return;
    setIsSaving(true);
    triggerHaptic('medium');
    
    try {
      const updatedUser = await APIClient.updateProfile({ [editingField]: editValue });
      if (onUserUpdate) onUserUpdate(updatedUser);
      setEditingField(null);
      showToast('Perfil actualizado correctamente', 'success');
    } catch (error: any) {
      showToast(error.message || 'Error al actualizar perfil', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const profileItems = [
    { id: 'fullName', icon: '👤', label: 'Datos personales', value: user?.fullName },
    { id: 'email', icon: '📧', label: 'Email', value: user?.email },
  ];

  const handlePreferenceAction = (label: string) => {
    triggerHaptic('light');
    showToast(`${label} estará disponible en la próxima actualización`, 'info');
  };

  return (
    <div className="settings-view fade-in">
      {renderSubViewHeader('Configuración', onBack)}
      
      <div className="settings-section" style={{ marginBottom: '32px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', paddingLeft: '8px' }}>Perfil</h3>
        <div className="settings-list-premium" style={{ background: '#F8FAFC', borderRadius: '24px', overflow: 'hidden' }}>
          {profileItems.map((item, i) => (
            <div key={i} className="settings-item-premium" style={{ 
              padding: '16px 20px', 
              borderBottom: '1px solid #F1F5F9' 
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: editingField === item.id ? '12px' : '0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '18px' }}>{item.icon}</span>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)' }}>{item.label}</span>
                    {editingField !== item.id && <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748B' }}>{item.value}</span>}
                  </div>
                </div>
                {editingField !== item.id ? (
                  <button 
                    onClick={() => handleEdit(item.id, item.value || '')}
                    style={{ background: '#F3F4F6', border: 'none', padding: '6px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 800, color: 'var(--text)' }}
                  >
                    Editar
                  </button>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setEditingField(null)}
                      style={{ background: 'white', border: '1px solid #E2E8F0', padding: '6px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 800 }}
                    >
                      Cancelar
                    </button>
                    <button 
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{ background: 'black', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '100px', fontSize: '12px', fontWeight: 800, opacity: isSaving ? 0.5 : 1 }}
                    >
                      {isSaving ? '...' : 'Guardar'}
                    </button>
                  </div>
                )}
              </div>
              {editingField === item.id && (
                <input 
                  autoFocus
                  className="premium-input-minimal fade-in"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #000', outline: 'none', fontWeight: 700, fontSize: '15px' }}
                />
              )}
            </div>
          ))}

          {/* Phone - Read only usually */}
          <div className="settings-item-premium" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '16px 20px', 
            borderBottom: '1px solid #F1F5F9' 
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px' }}>📞</span>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)' }}>Teléfono</span>
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#64748B' }}>{user?.phone}</span>
              </div>
            </div>
          </div>

          {/* Verification Status */}
          <div className="settings-item-premium" style={{ 
            padding: '16px 20px', 
            background: user?.verified ? 'transparent' : '#FFFBEB'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '18px' }}>🛡️</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 800, fontSize: '14px', color: 'var(--text)' }}>Estado de cuenta</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: user?.verified ? '#10B981' : '#D97706' }}>
                    {user?.verified ? 'Cuenta verificada ✓' : 'Pendiente de verificación'}
                  </span>
                </div>
              </div>
              {!user?.verified && (
                <button 
                  onClick={() => { triggerHaptic('medium'); if (onVerify) onVerify(); }}
                  style={{ background: '#000', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '100px', fontSize: '12px', fontWeight: 900, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                >
                  Verificar ahora
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h3 style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', paddingLeft: '8px' }}>Preferencias</h3>
        <div className="settings-list-premium" style={{ background: '#F8FAFC', borderRadius: '24px', overflow: 'hidden' }}>
          {[
            { icon: '🔔', label: 'Notificaciones' },
            { icon: '💳', label: 'Métodos de pago' },
            { icon: '🔒', label: 'Privacidad y datos' }
          ].map((item, i) => (
            <div key={i} className="settings-item-premium interactive-scale" onClick={() => handlePreferenceAction(item.label)} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px', 
              cursor: 'pointer',
              borderBottom: i < 2 ? '1px solid #F1F5F9' : 'none' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span>{item.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '15px' }}>{item.label}</span>
              </div>
              <span style={{ opacity: 0.3 }}>›</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ZippProView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { showToast } = useToast();

  const benefits = [
    { icon: '💎', title: 'Ahorro Garantizado', desc: 'Hasta 40% de descuento en todos tus viajes.' },
    { icon: '⚡', title: 'Prioridad Zipp', desc: 'Asignación más rápida incluso en horas pico.' },
    { icon: '👑', title: 'Soporte VIP', desc: 'Atención personalizada prioritaria 24/7.' }
  ];

  return (
    <div className="zipp-pro-view fade-in">
      {renderSubViewHeader('Zipp PRO', onBack)}
      
      <div className="pro-hero-card stagger-in" style={{ 
        background: 'linear-gradient(135deg, #000 0%, #333 100%)', 
        padding: '32px 24px', 
        borderRadius: '28px', 
        color: 'white', 
        textAlign: 'center',
        marginBottom: '32px',
        boxShadow: '0 15px 35px rgba(0,0,0,0.2)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="pro-shine" style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 70%)', pointerEvents: 'none' }}></div>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏷️</div>
        <h3 style={{ fontSize: '28px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-0.5px' }}>ZIPP <span style={{ color: '#FCD34D' }}>PRO</span></h3>
        <p style={{ fontSize: '15px', opacity: 0.7, lineHeight: 1.5 }}>Eleva tu experiencia de movilidad al nivel más exclusivo.</p>
      </div>

      <div className="pro-benefits-list" style={{ display: 'grid', gap: '16px', marginBottom: '40px' }}>
        {benefits.map((b, i) => (
          <div key={i} className="pro-benefit-item stagger-in" style={{ animationDelay: `${(i+1)*0.1}s`, display: 'flex', gap: '16px', alignItems: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '20px' }}>
            <div style={{ fontSize: '24px', width: '48px', height: '48px', borderRadius: '14px', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 10px rgba(0,0,0,0.03)' }}>{b.icon}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: '15px' }}>{b.title}</div>
              <div style={{ fontSize: '13px', opacity: 0.6, marginTop: '2px' }}>{b.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button 
        className="btn-subscribe-pro active-scale" 
        onClick={() => { triggerHaptic('success'); showToast('Zipp PRO estará disponible muy pronto', 'success'); }}
        style={{ width: '100%', background: '#000', color: 'white', padding: '20px', borderRadius: '20px', fontWeight: 900, fontSize: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
      >
        Suscribirme ahora
      </button>
      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Términos y condiciones aplican</p>
    </div>
  );
};

const SafetyView: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <div className="safety-view fade-in">
    {renderSubViewHeader('Guía de seguridad', onBack)}
    
    <div className="safety-cards-container" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="premium-safety-main stagger-in" style={{ 
        background: 'linear-gradient(135deg, #000 0%, #333 100%)', 
        padding: '24px', 
        borderRadius: '24px', 
        color: 'white',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
      }}>
        <div style={{ fontSize: '24px', marginBottom: '12px' }}>🛡️</div>
        <h3 style={{ fontSize: '20px', fontWeight: 900, marginBottom: '8px' }}>Tu seguridad es nuestra prioridad</h3>
        <p style={{ fontSize: '14px', opacity: 0.8, lineHeight: '1.6' }}>
          Hemos diseñado cada detalle de la experiencia ZIPP para que viajes con total confianza y tranquilidad.
        </p>
      </div>

      <div className="safety-feature-list" style={{ display: 'grid', gap: '16px' }}>
        {[
          { icon: '👨‍✈️', title: 'Conductores Verificados', desc: 'Validamos identidad y antecedentes rigurosamente.' },
          { icon: '📍', title: 'Seguimiento GPS', desc: 'Tu viaje es monitoreado en tiempo real 24/7.' },
          { icon: '📲', title: 'Comparte tu Viaje', desc: 'Envía tu ubicación a contactos de confianza.' },
          { icon: '🚨', title: 'Botón de Emergencia', desc: 'Acceso directo al 911 en caso de cualquier incidente.' }
        ].map((item, i) => (
          <div key={i} className="safety-feature-item stagger-in" style={{ 
            animationDelay: `${(i + 1) * 0.1}s`,
            display: 'flex', 
            alignItems: 'center', 
            gap: '16px', 
            padding: '16px', 
            background: '#F8FAFC', 
            borderRadius: '20px' 
          }}>
            <div style={{ fontSize: '24px' }}>{item.icon}</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--text)' }}>{item.title}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="safety-trust-banner stagger-in" style={{ animationDelay: '0.5s', textAlign: 'center', padding: '20px', opacity: 0.5 }}>
        <p style={{ fontSize: '12px', fontWeight: 700 }}>CERTIFICADO DE SEGURIDAD ZIPP 2026</p>
      </div>
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
        showToast('Cargando guía de seguridad...', 'info');
        setTimeout(() => onAction('safety'), 600);
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

export const AccountMenuSheet: React.FC<AccountMenuSheetProps> = ({ 
  session, 
  currentMode, 
  hasActiveRide, 
  onSwitchMode, 
  onClose, 
  onVerifyIdentity, 
  onUserUpdate 
}) => {
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
      case 'safety':
        return <SafetyView onBack={() => handleAction('help')} />;
      case 'settings':
        return <SettingsView 
                  session={session} 
                  onBack={handleBack} 
                  onVerify={onVerifyIdentity} 
                  onUserUpdate={onUserUpdate}
                />;
      case 'zipp-pro':
        return <ZippProView onBack={handleBack} />;
      default:
        return null;
    }
  }, [view, userName, currentMode, hasActiveRide, onSwitchMode, onClose, session, onVerifyIdentity, onUserUpdate]);

  return (
    <div className="account-menu-sheet-container" style={{ padding: '24px', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
       {currentView}
    </div>
  );
};
