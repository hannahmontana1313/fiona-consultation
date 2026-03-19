import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({});

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, duration);
  }, []);

  const icons = { info: '✦', success: '✓', warning: '⚠️', error: '✕' };
  const colors = {
    info: 'var(--v)',
    success: '#2A8A50',
    warning: '#B07800',
    error: '#C0305A',
  };

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className="toast">
            <span style={{ color: colors[t.type], fontSize: '16px', flexShrink: 0 }}>
              {icons[t.type]}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--txt)', lineHeight: '1.5' }}>
              {t.message}
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
