import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 4500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const ICONS = {
    success: <CheckCircle size={16} />,
    error:   <AlertCircle size={16} />,
    warning: <AlertTriangle size={16} />,
    info:    <Info size={16} />,
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container */}
      <div style={{
        position: 'fixed', bottom: 24, right: 24,
        zIndex: 999, display: 'flex', flexDirection: 'column', gap: 10, width: 340,
        pointerEvents: 'none',
      }}>
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast-${toast.type}`}
               style={{ pointerEvents: 'all' }}>
            <span style={{ flexShrink: 0 }}>{ICONS[toast.type] || ICONS.info}</span>
            <span style={{ flex: 1, fontSize: 14 }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.6, padding: '2px', display: 'flex', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.6'}>
              <X size={15} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
