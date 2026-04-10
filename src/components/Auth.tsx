import { useState, useEffect, useRef } from 'react';
import APIClient from '../lib/api';
import { useToast } from './ToastProvider';
import { triggerHaptic } from '../lib/haptics';
import { auth } from '../lib/firebase';
import { 
  RecaptchaVerifier, 
  signInWithPhoneNumber, 
  linkWithPhoneNumber,
  linkWithPopup,
  GoogleAuthProvider,
  ConfirmationResult 
} from 'firebase/auth';

interface AuthProps {
  onSuccess?: (user: any) => void;
  initialMode?: 'passenger' | 'driver';
  reason?: string;
}

export function Auth({ onSuccess, initialMode, reason }: AuthProps) {
    const { showToast } = useToast();
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'phone' | 'otp' | 'signup'>('phone');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    
    const recaptchaContainerRef = useRef<HTMLDivElement>(null);
    const recaptchaVerifier = useRef<RecaptchaVerifier | null>(null);
    const confirmationResult = useRef<ConfirmationResult | null>(null);

    useEffect(() => {
      // Initialize Invisible Recaptcha
      if (!recaptchaVerifier.current && recaptchaContainerRef.current) {
        recaptchaVerifier.current = new RecaptchaVerifier(auth, recaptchaContainerRef.current, {
          'size': 'invisible',
          'callback': () => {
            console.log('Recaptcha verified');
          }
        });
      }
      
      return () => {
        if (recaptchaVerifier.current) {
          recaptchaVerifier.current.clear();
          recaptchaVerifier.current = null;
        }
      };
    }, []);

    const handleSendOTP = async (e: React.FormEvent) => {
      e.preventDefault();
      if (phone.length < 10) return showToast('Ingresa un número válido', 'warning');
      
      setLoading(true);
      triggerHaptic('medium');
      
      try {
        const fullPhone = `+52${phone}`;
        const verifier = recaptchaVerifier.current;
        if (!verifier) throw new Error('Error al inicializar verificador');

        const currentUser = auth.currentUser;
        let result: ConfirmationResult;

        if (currentUser && currentUser.isAnonymous) {
          // Upgrade Anonymous Account
          result = await linkWithPhoneNumber(currentUser, fullPhone, verifier);
        } else {
          // Fresh Sign In (should not happen if App.tsx works, but safe fallback)
          result = await signInWithPhoneNumber(auth, fullPhone, verifier);
        }
        
        confirmationResult.current = result;
        setStep('otp');
        showToast('¡Código enviado!', 'success');
      } catch (err: any) {
        console.error('Firebase Auth Error:', err);
        const msg = err.code === 'auth/credential-already-in-use' 
          ? 'Este número ya está vinculado a otra cuenta' 
          : 'Error al enviar código. Intenta de nuevo.';
        showToast(msg, 'error');
        if (recaptchaVerifier.current) recaptchaVerifier.current.clear();
      } finally {
        setLoading(false);
      }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!confirmationResult.current || otp.length < 6) return;
      
      setLoading(true);
      triggerHaptic('medium');
      
      try {
        const result = await confirmationResult.current.confirm(otp);
        const user = result.user;
        const idToken = await user.getIdToken();
        
        // Final sync with our backend
        const res = await APIClient.verifyOTP(phone, idToken);
        
        if (res.isNewUser) {
          setStep('signup');
        } else {
          showToast('¡Bienvenido de vuelta!', 'success');
          if (onSuccess) onSuccess(res.user);
          else setTimeout(() => window.location.reload(), 1000);
        }
      } catch (err: any) {
        console.error('OTP Verification Error:', err);
        showToast('Código incorrecto o expirado', 'error');
      } finally {
        setLoading(false);
      }
    };

    const handleGoogleLogin = async () => {
      setLoading(true);
      triggerHaptic('medium');
      const provider = new GoogleAuthProvider();
      
      try {
        const currentUser = auth.currentUser;
        let result;
        if (currentUser && currentUser.isAnonymous) {
           result = await linkWithPopup(currentUser, provider);
        } else {
           result = await linkWithPopup(auth.currentUser!, provider); // Linking to existing if any
        }
        
        const user = result.user;
        const idToken = await user.getIdToken();
        
        // Check if phone number is present
        if (!user.phoneNumber) {
           showToast('Google conectado. Ahora vincula tu teléfono.', 'success');
           setStep('phone'); // Enforce mandatory phone
           return;
        }

        const res = await APIClient.verifyOTP(user.phoneNumber, idToken);
        if (res.isNewUser) {
          setStep('signup');
        } else {
          showToast('¡Bienvenido!', 'success');
          if (onSuccess) onSuccess(res.user);
        }
      } catch (err: any) {
        console.error('Google Auth Error:', err);
        showToast('Error al conectar con Google', 'error');
      } finally {
        setLoading(false);
      }
    };

    const handleSignup = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      triggerHaptic('success');
      try {
        const user = await APIClient.signup({
          email,
          phone,
          fullName,
          userType: initialMode || 'passenger'
        });
        showToast('¡Cuenta creada!', 'success');
        if (onSuccess) onSuccess(user);
        else setTimeout(() => window.location.reload(), 1000);
      } catch (err: any) {
        showToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="auth-container premium-card-anim">
      <div className="auth-card">
        <div ref={recaptchaContainerRef}></div>

        <div className="auth-header">
           <div className="auth-logo-badge">Z</div>
           <h1 className="brand" style={{ fontSize: '32px', letterSpacing: '-1px' }}>ZIPP</h1>
           {reason && <p className="auth-reason-badge fade-in">{reason}</p>}
        </div>

        <div className="auth-form-wrapper stagger-in">
          {(step === 'phone' || step === 'otp') && (
             <div className="social-auth-minimal" style={{ marginBottom: '24px' }}>
                <button 
                  className="google-btn-premium interactive-scale" 
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" />
                  Continuar con Google
                </button>
                <div className="auth-divider"><span>ó con tu número</span></div>
             </div>
          )}

          {step === 'phone' && (
            <form onSubmit={handleSendOTP} className="auth-form-internal">
              <h2 className="minimal-title-md">Ingresa tu número</h2>
              <p className="minimal-desc-xs">Obligatorio para validar tu identidad</p>
              
              <div className="form-group-premium">
                <span className="country-prefix">+52</span>
                <input
                  type="tel"
                  placeholder="313 000 0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  maxLength={10}
                  autoFocus
                  required
                />
              </div>

              <button type="submit" id="sign-in-button" className="confirm-primary-btn" disabled={loading}>
                {loading ? '...' : 'CONTINUAR'}
              </button>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP} className="auth-form-internal">
              <h2 className="minimal-title-md">Verifica tu número</h2>
              <p className="minimal-desc-xs">Hemos enviado un código SMS al {phone}</p>
              
              <div className="form-group-premium otp-group">
                <input
                  type="text"
                  placeholder="0 0 0 0 0 0"
                  value={otp}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setOtp(val);
                    if (val.length === 6) {
                       // Trigger verify automatically
                       setTimeout(() => {
                         const form = e.target.closest('form');
                         if (form) form.requestSubmit();
                       }, 100);
                    }
                   }}
                  maxLength={6}
                  className="otp-input-field"
                  autoFocus
                  required
                />
              </div>

              <button type="submit" className="confirm-primary-btn" disabled={loading || otp.length < 6}>
                {loading ? 'VERIFICANDO...' : 'VERIFICAR CÓDIGO'}
              </button>
              
              <button type="button" className="text-btn-minimal" onClick={() => { triggerHaptic('light'); setStep('phone'); }} style={{ marginTop: '12px' }}>
                ¿Número incorrecto? Cambiar
              </button>
            </form>
          )}

          {step === 'signup' && (
            <form onSubmit={handleSignup} className="auth-form-internal">
              <h2 className="minimal-title-md">¡Bienvenido a Zipp!</h2>
              <p className="minimal-desc-xs">Solo necesitamos unos datos básicos para crear tu cuenta</p>
              
              <div className="form-group-premium">
                <input
                  type="text"
                  placeholder="Tu nombre completo"
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
