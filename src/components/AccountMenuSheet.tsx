import React, { useState, useMemo, useEffect } from 'react';
import APIClient, { APIRide } from '../lib/api';
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

const WalletView: React.FC<{ onBack: () => void, driverData: any }> = ({ onBack, driverData }) => {
  const isDriver = driverData !== null;
  const balance = isDriver ? (driverData.totalEarnings || 0) : 0;
  const commission = isDriver ? (driverData.unpaidCommissionAmount || 0) : 0;

  // Simulate recent transactions for MVP visual completeness
  const transactions = useMemo(() => [
    { id: '1', type: 'Ingreso', desc: 'Viaje finalizado #1289', amount: balance * 0.4, date: 'Hoy, 2:45 PM' },
    { id: '2', type: 'Comisión', desc: 'Retención de servicio Zipp', amount: -(commission * 0.5), date: 'Hoy, 10:15 AM' },
    { id: '3', type: 'Ingreso', desc: 'Viaje finalizado #1287', amount: balance * 0.6, date: 'Ayer, 8:20 PM' }
  ].filter(t => balance > 0 || (isDriver && t.type === 'Comisión' && commission > 0)), [balance, commission, isDriver]);

  return (
    <div className="wallet-view fade-in">
      {renderSubViewHeader('Billetera', onBack)}
      
      <div className="premium-card-wallet wallet-gradient-card" style={{ 
        background: 'linear-gradient(135deg, #111827 0%, #374151 100%)', 
        color: 'white', 
        borderRadius: '28px', 
        padding: '32px', 
        marginBottom: '32px', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div className="card-shine" style={{ position: 'absolute', top: '-50%', left: '-50%', width: '200%', height: '200%', background: 'radial-gradient(circle, rgba(255,255,255,0.05) 0%, transparent 60%)', pointerEvents: 'none' }}></div>
        <div style={{ opacity: 0.7, fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
          {isDriver ? 'Ganancias Totales' : 'Saldo Zipp Cash'}
        </div>
        <div style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.02em' }}>
          ${balance.toFixed(2)}
        </div>
        {isDriver && commission > 0 && (
          <div className="commission-badge-premium" style={{ 
            marginTop: '20px', 
            background: 'rgba(239, 68, 68, 0.15)', 
            backdropFilter: 'blur(10px)',
            padding: '10px 16px', 
            borderRadius: '14px', 
            fontSize: '13px', 
            fontWeight: 700,
            border: '1px solid rgba(239, 68, 68, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ color: '#FCA5A5' }}>⚠️ Pendiente:</span>
            <span>${commission.toFixed(2)}</span>
          </div>
        )}
      </div>

      <div className="wallet-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '40px' }}>
         <button className="wallet-btn-premium active-scale" style={{ background: '#F3F4F6', padding: '24px 16px', borderRadius: '22px', border: 'none', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>🏦</div>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#111827' }}>Recargar</div>
         </button>
         <button className="wallet-btn-premium active-scale" style={{ background: '#F3F4F6', padding: '24px 16px', borderRadius: '22px', border: 'none', textAlign: 'center' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px' }}>📤</div>
            <div style={{ fontWeight: 800, fontSize: '14px', color: '#111827' }}>Retirar</div>
         </button>
      </div>

      <h3 style={{ fontSize: '18px', fontWeight: 900, marginBottom: '20px', color: '#111827' }}>Actividad reciente</h3>
      <div className="transaction-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {transactions.length === 0 ? (
          <div style={{ opacity: 0.4, textAlign: 'center', padding: '60px 0', fontWeight: 600 }}>No hay transacciones todavía</div>
        ) : (
          transactions.map(t => (
            <div key={t.id} className="transaction-item fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', background: '#F8FAFC', borderRadius: '18px' }}>
               <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: t.amount > 0 ? '#DCFCE7' : '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                    {t.amount > 0 ? '💰' : '📉'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: '#1F2937' }}>{t.desc}</div>
                    <div style={{ fontSize: '12px', color: '#6B7280', fontWeight: 600 }}>{t.date}</div>
                  </div>
               </div>
               <div style={{ fontWeight: 900, fontSize: '16px', color: t.amount > 0 ? '#10B981' : '#EF4444' }}>
                 {t.amount > 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
               </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const TripsView: React.FC<{ onBack: () => void, onClose: () => void }> = ({ onBack, onClose }) => {
  const [rides, setRides] = useState<APIRide[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    APIClient.getMyRides().then(data => {
      if (mounted) {
        setRides(data || []);
        setLoading(false);
      }
    }).catch(e => {
      console.error('Error fetching rides', e);
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      requested: 'Buscando conductor',
      accepted: 'Aceptado',
      arrived: 'Conductor llegó',
      in_progress: 'En curso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10B981';
      case 'cancelled': return '#EF4444';
      case 'in_progress':
      case 'arrived':
      case 'accepted': return '#3B82F6';
      default: return '#6B7280';
    }
  };

  return (
    <div className="trips-view fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {renderSubViewHeader('Tus Viajes', onBack)}
      
      <div className="trips-tabs" style={{ display: 'flex', gap: '24px', borderBottom: '1px solid #E5E7EB', marginBottom: '24px' }}>
         <div style={{ paddingBottom: '12px', borderBottom: '2px solid black', fontWeight: 800 }}>Pasados</div>
         <div style={{ paddingBottom: '12px', opacity: 0.5, fontWeight: 700 }}>Programados</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '24px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-loader" style={{ height: '120px', borderRadius: '20px' }}></div>
            ))}
          </div>
        ) : rides.length === 0 ? (
          <div className="stagger-in" style={{ padding: '60px 20px', textAlign: 'center' }}>
             <div style={{ fontSize: '48px', marginBottom: '16px', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))' }}>🚗</div>
             <p style={{ fontWeight: 800, fontSize: '18px', color: 'var(--text)', marginBottom: '8px' }}>Aún no hay viajes</p>
             <p style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Tus viajes pasados y actuales aparecerán aquí.</p>
             <button onClick={() => { triggerHaptic('medium'); onClose(); }} style={{ marginTop: '32px', background: 'var(--text)', color: 'white', padding: '16px 32px', borderRadius: '100px', fontWeight: 900, boxShadow: '0 8px 20px rgba(0,0,0,0.15)' }}>Pide un viaje ahora</button>
          </div>
        ) : (
          <div className="stagger-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {rides.map((ride, i) => (
              <div key={ride.id} className="interactive-scale glass-v2-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', animationDelay: `${i * 0.05}s` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ fontSize: '20px' }}>{ride.rideType === 'ride' ? '🚗' : '📦'}</span>
                     <span style={{ fontWeight: 800, fontSize: '15px' }}>
                       {ride.createdAt ? new Date(ride.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Fecha no disponible'}
                     </span>
                   </div>
                   <span style={{ fontWeight: 800, fontSize: '16px' }}>${ride.totalFare}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px 0', borderTop: '1px solid var(--border-light)', borderBottom: '1px solid var(--border-light)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--text)', marginTop: '6px' }}></div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ride.pickupAddress.split(',')[0]}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ width: '8px', height: '8px', background: 'var(--accent-alt)', marginTop: '6px' }}></div>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{ride.dropoffAddress.split(',')[0]}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 800, 
                    color: getStatusColor(ride.status), 
                    background: `${getStatusColor(ride.status)}15`, 
                    padding: '4px 10px', 
                    borderRadius: '100px' 
                  }}>
                    {getStatusLabel(ride.status)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

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

      <div className="settings-section" style={{ marginBottom: '32px' }}>
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

      <div className="settings-section">
        <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '16px', paddingLeft: '8px' }}>Zona de Peligro</h3>
        <div className="settings-list-premium" style={{ background: '#FFF1F2', borderRadius: '24px', overflow: 'hidden', border: '1px solid #FECACA' }}>
          <div className="settings-item-premium interactive-scale" 
            onClick={async () => {
              triggerHaptic('error');
              if (window.confirm('¿Estás COMPLETAMENTE seguro? Esta acción borrará todos tus viajes, saldo y datos permanentemente y no se puede deshacer.')) {
                if (window.confirm('Confirmación final: ¿Realmente deseas eliminar tu cuenta de ZIPP?')) {
                  try {
                    await APIClient.deleteAccount();
                    showToast('Cuenta eliminada correctamente', 'success');
                    window.location.reload();
                  } catch (e: any) {
                    showToast(e.message, 'error');
                  }
                }
              }
            }}
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px', 
              cursor: 'pointer'
            }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '18px' }}>🗑️</span>
              <span style={{ fontWeight: 800, fontSize: '15px', color: '#B91C1C' }}>Eliminar mi cuenta</span>
            </div>
            <span style={{ opacity: 0.3, color: '#B91C1C' }}>›</span>
          </div>
        </div>
        <p style={{ padding: '16px', fontSize: '12px', color: '#991B1B', fontWeight: 600, opacity: 0.7 }}>
          Al eliminar tu cuenta, todos tus datos personales serán borrados de nuestros servidores según nuestra política de privacidad exigida por Apple.
        </p>
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
  onSwitchMode: () => void,
  session: any,
  driverData: any
}> = ({ userName, currentMode, hasActiveRide, onAction, onSwitchMode, session, driverData }) => (
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

    <div className="zipp-cash-premium interactive-scale" onClick={() => onAction('wallet')} style={{ 
      background: 'linear-gradient(135deg, #111827 0%, #1F2937 100%)', 
      borderRadius: '24px', 
      padding: '24px', 
      marginBottom: '32px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      color: 'white', 
      cursor: 'pointer', 
      boxShadow: '0 12px 30px rgba(0,0,0,0.1)' 
    }}>
      <div className="cash-info">
        <div className="cash-label" style={{ opacity: 0.6, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: '6px' }}>
           {session?.user?.userType === 'driver' ? 'Ganancias Reportadas' : 'Zipp Cash'}
        </div>
        <div className="cash-amount" style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.02em' }}>
           ${((session?.user?.userType === 'driver' ? driverData?.totalEarnings : 0) || 0).toFixed(2)}
        </div>
      </div>
      <div className="cash-arrow-premium" style={{ width: '44px', height: '44px', borderRadius: '14px', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>💰</div>
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

  const [driverData, setDriverData] = useState<any>(null);

  useEffect(() => {
    if (session?.user?.userType === 'driver') {
      APIClient.getDriverSettings().then(setDriverData).catch(console.error);
    }
  }, [session, view]);

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
                  session={session}
                  driverData={driverData}
                />;
      case 'wallet':
        return <WalletView onBack={handleBack} driverData={driverData} />;
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
