import React, { useRef, useState } from 'react';
import APIClient from '../lib/api';
import { triggerHaptic } from '../lib/haptics';

interface ImagePickerProps {
  currentImageUrl: string | null | undefined;
  onImageUploaded: (url: string) => void;
  size?: number;
}

export const ImagePicker: React.FC<ImagePickerProps> = ({ currentImageUrl, onImageUploaded, size = 64 }) => {
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    triggerHaptic('light');
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    triggerHaptic('medium');
    try {
      const res = await APIClient.uploadFile(file);
      if (res.url) {
        onImageUploaded(res.url);
      }
    } catch (err) {
      console.error('Error uploading image:', err);
      alert('Error al subir la imagen. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="image-picker-container interactive-scale"
      onClick={handleClick}
      style={{ 
        width: size, 
        height: size, 
        borderRadius: '50%', 
        overflow: 'hidden', 
        position: 'relative',
        cursor: 'pointer',
        background: '#F1F5F9',
        border: '3px solid white',
        boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
      }}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        style={{ display: 'none' }} 
        accept="image/*"
        onChange={handleFileChange}
      />
      
      {loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.7)', zIndex: 2 }}>
           <div className="pulse-indicator"></div>
        </div>
      ) : null}

      {currentImageUrl ? (
        <img 
          src={currentImageUrl} 
          alt="Profile" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 0, right: 0, left: 0, background: 'rgba(0,0,0,0.3)', color: 'white', fontSize: '10px', fontWeight: 900, textAlign: 'center', padding: '2px 0' }}>
         EDITAR
      </div>
    </div>
  );
};
