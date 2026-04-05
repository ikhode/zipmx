import { useState, useEffect } from 'react';

export function StatusBanner() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="status-banner-offline" style={{
      position: 'fixed',
      top: 'env(safe-area-inset-top, 0px)',
      left: 0,
      right: 0,
      background: '#EF4444',
      color: 'white',
      padding: '8px 16px',
      textAlign: 'center',
      fontSize: '13px',
      fontWeight: 800,
      zIndex: 100000,
      animation: 'slideInDown 0.3s ease-out'
    }}>
      Sin conexión a Internet. Revisa tu red.
    </div>
  );
}
