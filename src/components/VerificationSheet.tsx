import { useState, useRef } from 'react';
import APIClient from '../lib/api';
import { useToast } from './ToastProvider';

interface VerificationSheetProps {
  type: 'passenger' | 'driver';
  onComplete: (user: any) => void;
  onClose: () => void;
}

export function VerificationSheet({ type, onComplete }: VerificationSheetProps) {
  const { showToast } = useToast();
  const [step, setStep] = useState<'info' | 'camera' | 'document' | 'processing'>('info');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  
  const dataURItoBlob = (dataURI: string) => {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], { type: mimeString });
  };
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const startCamera = async () => {
    setStep('camera');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      showToast('Se requiere permiso de cámara para la verificación de identidad.', 'warning');
      setStep('info');
    }
  };


  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const data = canvasRef.current.toDataURL('image/jpeg');
        
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());

        if (step === 'camera') {
          setProfilePhoto(data);
          if (type === 'driver') setStep('document');
          else submitVerification(data, null);
        } else {
          submitVerification(profilePhoto!, data);
        }
      }
    }
  };

  const submitVerification = async (profileData: string, idData: string | null) => {
    setStep('processing');
    setIsSubmitting(true);
    try {
      // 1. Upload to R2
      const profileBlob = dataURItoBlob(profileData);
      const profileFile = new File([profileBlob], `profile_${Date.now()}.jpg`, { type: 'image/jpeg' });
      const profileRes = await APIClient.uploadFile(profileFile);
      
      let idUrl = null;
      if (idData) {
        const idBlob = dataURItoBlob(idData);
        const idFile = new File([idBlob], `id_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const idRes = await APIClient.uploadFile(idFile);
        idUrl = idRes.url;
      }

      // 2. Original Verification with URLs
      const result = await APIClient.verifyIdentity({
        profilePhoto: profileRes.url,
        idPhoto: idUrl,
        type: type
      });

      if (Object.keys(result).includes('success') && result.success) {
        onComplete(result.user);
      } else {
        showToast('Validación fallida: ' + (result.message || 'Error desconocido'), 'error');
        setStep('info');
      }
    } catch (error: any) {
      console.error('Verification Error:', error);
      showToast('Error en el proceso de verificación: ' + error.message, 'error');
      setStep('info');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="verification-sheet premium-card-anim">
      {step === 'info' && (
        <div className="step-content">
          <h2 style={{ fontSize: '24px', fontWeight: 800 }}>{type === 'driver' ? 'Registro de Conductor' : 'Verifica tu identidad'}</h2>
          <p style={{ margin: '16px 0 24px', color: '#6B7280' }}>
            {type === 'driver' 
              ? 'Necesitamos validar tu identidad y documentos con nuestra IA para garantizar la seguridad de la comunidad.'
              : 'Verifica tu perfil con una selfie rápida para acceder a todos los servicios de Zipp.'}
          </p>
          <div className="info-list">
             <div className="info-item">📸 Selfie de comprobación</div>
             {type === 'driver' && <div className="info-item">🪪 INE o Licencia Vigente</div>}
             <div className="info-item">🔍 Detección de duplicados por IA</div>
          </div>
          <button className="confirm-primary-btn" onClick={startCamera} style={{ marginTop: '32px' }} disabled={isSubmitting}>
             Comenzar Validación
          </button>
        </div>
      )}

      {(step === 'camera' || step === 'document') && (
        <div className="step-content camera-view">
          <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>
            {step === 'camera' ? 'Tómate una Selfie' : 'Captura tu Identificación'}
          </h2>
          <div className="video-container" style={{ position: 'relative', overflow: 'hidden', borderRadius: '16px', background: '#000', aspectRatio: '3/4' }}>
            <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div className="camera-overlay">
               <div className={step === 'camera' ? 'face-guide' : 'doc-guide'}></div>
            </div>
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div className="camera-actions" style={{ marginTop: '24px' }}>
             <button className="back-camera-btn" onClick={() => setStep('info')}>
                Volver
             </button>
             <button className="capture-btn" onClick={capturePhoto} aria-label="Tomar foto">
                <div className="capture-inner"></div>
             </button>
             <div style={{ width: '60px' }}></div> {/* Spacer to balance the layout */}
          </div>
        </div>
      )}

      {step === 'processing' && (
        <div className="step-content processing-view" style={{ textAlign: 'center', padding: '40px 0' }}>
           <div className="ai-scanner"></div>
           <h2 style={{ fontSize: '22px', fontWeight: 800, marginTop: '24px' }}>Analizando con Zipp AI</h2>
           <p style={{ color: '#6B7280', marginTop: '8px' }}>Validando biométricos y previniendo suplantación.</p>
           <div className="loading-bar-container" style={{ marginTop: '32px' }}>
              <div className="loading-bar-active"></div>
           </div>
        </div>
      )}
    </div>
  );
}
