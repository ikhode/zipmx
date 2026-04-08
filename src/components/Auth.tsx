import APIClient from '../lib/api';
import { useToast } from './ToastProvider';
import { triggerHaptic } from '../lib/haptics';
import { useState } from 'react';

export function Auth() {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'phone' | 'otp' | 'signup'>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');

    const handleSendOTP = async (e: React.FormEvent) => {
      e.preventDefault();
      if (phone.length < 10) return showToast('Ingresa un número válido', 'warning');
      setLoading(true);
      triggerHaptic('medium');
      try {
        await APIClient.sendOTP(phone);
        setStep('otp');
        showToast('¡Código enviado!', 'success');
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
      e.preventDefault();
      if (otp.length < 6) return;
      setLoading(true);
      triggerHaptic('medium');
      try {
        const res = await APIClient.verifyOTP(phone, otp);
        if (res.isNewUser) {
          setStep('signup');
        } else {
          showToast('¡Bienvenido de vuelta!', 'success');
          setTimeout(() => window.location.reload(), 1000);
        }
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

    const handleSignup = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      triggerHaptic('success');
      try {
        await APIClient.signup({
          email,
          phone,
          fullName,
          userType: 'passenger',
          password: 'zipp-otp-auth-' + Math.random()
        });
        showToast('¡Cuenta creada!', 'success');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="auth-container premium-card-anim">
      <div className="auth-card">
        <div className="auth-header">
           <div className="auth-logo-badge">Z</div>
           <h1 className="brand" style={{ fontSize: '32px', letterSpacing: '-1px' }}>ZIPP</h1>
           <p className="brand-tagline">Moviendo a Tecomán con tecnología</p>
        </div>

        <div className="auth-form-wrapper stagger-in">
          {step === 'phone' && (
            <form onSubmit={handleSendOTP} className="auth-form-internal">
              <h2 className="minimal-title-md">Ingresa tu número</h2>
              <p className="minimal-desc-xs">Te enviaremos un código de seguridad por SMS</p>
              
              <div className="form-group-premium">
                <span className="country-prefix">+52</span>
                <input
                  type="tel"
                  placeholder="313 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={10}
                  autoFocus
                  required
                />
              </div>

              <button type="submit" className="confirm-primary-btn" disabled={loading}>
                {loading ? '...' : 'CONTINUAR'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="auth-form-internal">
              <h2 className="minimal-title-md">Verifica tu número</h2>
              <p className="minimal-desc-xs">Enviamos un código al {phone}</p>
              
              <div className="form-group-premium otp-group">
                <input
                  type="text"
                  placeholder="· · · · · ·"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  style={{ textAlign: 'center', letterSpacing: '8px', fontSize: '24px' }}
                  autoFocus
                  required
                />
              </div>

              <button type="submit" className="confirm-primary-btn" disabled={loading || otp.length < 6}>
                {loading ? '...' : 'VERIFICAR'}
              </button>
              
              <button type="button" className="text-btn-minimal" onClick={() => setStep('phone')} style={{ marginTop: '12px' }}>
                Cambiar número
              </button>
            </form>
          )}

          {step === 'signup' && (
            <form onSubmit={handleSignup} className="auth-form-internal">
              <h2 className="minimal-title-md">¡Casi listo!</h2>
              <p className="minimal-desc-xs">Completa tu perfil para empezar</p>
              
              <div className="form-group-premium">
                <input
                  type="text"
                  placeholder="Nombre Completo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group-premium">
                <input
                  type="email"
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="confirm-primary-btn" disabled={loading}>
                {loading ? '...' : 'CREAR MI CUENTA'}
              </button>
            </form>
          )}
        </div>

        <div className="auth-footer-info">
          <p>Al continuar, aceptas nuestros <span onClick={() => { triggerHaptic('light'); (window as any).setShowLegal?.('Términos y Condiciones'); }}>Términos y Condiciones</span></p>
        </div>
      </div>
    </div>
  );
}
