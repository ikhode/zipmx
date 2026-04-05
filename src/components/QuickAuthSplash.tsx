import { useState } from 'react';
import APIClient from '../lib/api';
import { useToast } from './ToastProvider';

interface QuickAuthSplashProps {
  userType: 'passenger' | 'driver';
  onClose: () => void;
  onShowFullAuth: () => void;
}

export function QuickAuthSplash({ userType, onClose, onShowFullAuth }: QuickAuthSplashProps) {
  const { showToast } = useToast();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleQuickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !phone) return;
    
    setLoading(true);
    try {
      await APIClient.quickSignup(fullName, phone, userType);
      window.location.reload();
    } catch (error: any) {
      showToast(error.message || 'Error en registro', 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="quick-auth-splash fade-in">
      <div className="splash-content">
        <div className="splash-header">
           <div className="logo-box-premium">
             <span>Zipp</span>
           </div>
           <p className="splash-subtitle">Para continuar, regístrate en segundos</p>
        </div>

        <form onSubmit={handleQuickSubmit} className="splash-form">
          <div className="express-input-group">
            <input
              type="text"
              placeholder="Nombre y Apellidos"
              className="express-field"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          
          <div className="express-input-group">
            <input
              type="tel"
              placeholder="Teléfono (10 dígitos)"
              className="express-field"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
              maxLength={10}
            />
          </div>

          <button type="submit" className="express-btn-primary" disabled={loading}>
            {loading ? 'Procesando...' : 'Comenzar ahora'}
          </button>
          
          <div className="splash-footer-links">
            <button type="button" className="splash-link" onClick={onShowFullAuth}>
              ¿Ya tienes cuenta? Inicia sesión
            </button>
            <button type="button" className="splash-link-cancel" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
