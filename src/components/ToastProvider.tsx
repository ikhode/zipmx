import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { triggerHaptic } from '../lib/haptics';

type ToastType = 'success' | 'error' | 'info' | 'warning';

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

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Trigger haptics based on type
    if (type === 'error') triggerHaptic('error');
    else if (type === 'success') triggerHaptic('success');
    else if (type === 'warning') triggerHaptic('medium');
    else triggerHaptic('light');

    setTimeout(() => {
      hideToast(id);
    }, 4000);
  }, [hideToast]);

  const getIcon = (type: ToastType) => {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      default: return 'ℹ';
    }
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="toast-portal-container">
          {toasts.map((toast) => (
            <div 
              key={toast.id} 
              className={`premium-toast toast-${toast.type}`}
              onClick={() => hideToast(toast.id)}
            >
              <div className="toast-icon-wrapper">{getIcon(toast.type)}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
          ))}
          <style>{`
            .toast-portal-container {
              position: fixed;
              top: calc(env(safe-area-inset-top, 0px) + 1rem);
              left: 50%;
              transform: translateX(-50%);
              z-index: 10000;
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
              pointer-events: none;
              width: 90%;
              max-width: 420px;
            }
            .premium-toast {
              background: rgba(15, 23, 42, 0.85); /* Default dark glass */
              backdrop-filter: blur(12px);
              -webkit-backdrop-filter: blur(12px);
              color: white;
              padding: 0.85rem 1.25rem;
              border-radius: 1.25rem;
              display: flex;
              align-items: center;
              gap: 0.85rem;
              box-shadow: 0 12px 24px -6px rgba(0, 0, 0, 0.4);
              border: 1px solid rgba(255, 255, 255, 0.1);
              pointer-events: all;
              cursor: pointer;
              transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
              animation: toastSlideIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            }
            .premium-toast:active {
              transform: scale(0.96);
              opacity: 0.8;
            }
            .toast-success { background: rgba(16, 185, 129, 0.9); box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.3); }
            .toast-error { background: rgba(239, 68, 68, 0.9); box-shadow: 0 10px 20px -5px rgba(239, 68, 68, 0.3); }
            .toast-warning { background: rgba(245, 158, 11, 0.9); box-shadow: 0 10px 20px -5px rgba(245, 158, 11, 0.3); }
            .toast-info { background: rgba(59, 130, 246, 0.9); box-shadow: 0 10px 20px -5px rgba(59, 130, 246, 0.3); }
            
            .toast-icon-wrapper {
              width: 26px;
              height: 26px;
              background: rgba(255, 255, 255, 0.2);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              flex-shrink: 0;
              font-size: 0.85rem;
              font-weight: 700;
            }
            .toast-message {
              font-size: 0.95rem;
              font-weight: 600;
              line-height: 1.4;
            }
            
            @keyframes toastSlideIn {
              from { opacity: 0; transform: translateY(-20px) scale(0.9); }
              to { opacity: 1; transform: translateY(0) scale(1); }
            }
          `}</style>
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

