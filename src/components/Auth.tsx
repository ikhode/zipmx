import { useState } from 'react';
import APIClient from '../lib/api';
import { useToast } from './ToastProvider';


export function Auth() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');

    async function handleAuth(e: React.FormEvent) {
      e.preventDefault();

      try {
        setLoading(true);

        if (isSignUp) {
          await APIClient.signup({
            email,
            phone,
            fullName,
            userType: 'passenger',
            password,
          });
          showToast('¡Cuenta creada exitosamente!', 'success');
        } else {
          await APIClient.login(email, password);
        }
        window.location.reload();
      } catch (error: any) {
        showToast(error.message || 'Error en la autenticación', 'error');
      } finally {
        setLoading(false);
      }
    }


  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1 className="brand">Zipp</h1>
          <p className="brand-tagline">Viajes y mandaditos al instante</p>
        </div>

        <form onSubmit={handleAuth} className="auth-form">
          <h2>{isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}</h2>

          {isSignUp && (
            <>
              <div className="form-group">
                <label htmlFor="fullName">Nombre Completo</label>
                <input
                  id="fullName"
                  type="text"
                  placeholder="Tu nombre completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Teléfono</label>
                <input
                  id="phone"
                  type="tel"
                  placeholder="10 dígitos"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              id="password"
              type="password"
              placeholder="Tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary btn-large" disabled={loading}>
            {loading ? 'Procesando...' : isSignUp ? 'Crear Cuenta' : 'Iniciar Sesión'}
          </button>

          <button
            type="button"
            className="btn-link"
            onClick={() => setIsSignUp(!isSignUp)}
          >
            {isSignUp
              ? '¿Ya tienes cuenta? Inicia sesión'
              : '¿No tienes cuenta? Regístrate'}
          </button>
        </form>

        <div className="auth-promo">
          <h3>Únete a Zipp</h3>
          <ul>
            <li>🚗 Viajes rápidos y seguros</li>
            <li>📦 Servicio de mandaditos</li>
            <li>💰 Primeros 5 viajes sin comisión para conductores</li>
            <li>⚡ La competencia de Uber y DiDi</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
