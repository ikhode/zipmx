import React, { createContext, useContext, useState, useCallback } from 'react';
import { triggerHaptic } from '../lib/haptics';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Trigger haptics based on type
    if (type === 'error') triggerHaptic('error');
    else if (type === 'success') triggerHaptic('success');
    else triggerHaptic('light');

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type} fade-in-up`}>
            {toast.message}
          </div>
        ))}
      </div>
      <style>{`
        .toast-container {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
          width: calc(100% - 40px);
          max-width: 400px;
        }
        .toast {
          background: var(--primary);
          color: white;
          padding: 16px 24px;
          border-radius: 20px;
          font-weight: 700;
          font-size: 14px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.2);
          text-align: center;
          pointer-events: all;
          backdrop-filter: blur(10px);
        }
        .toast-error { background: #EF4444; }
        .toast-success { background: #10B981; }
        .fade-in-up {
          animation: fadeInUp 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
};
