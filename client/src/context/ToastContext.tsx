import { createContext, useCallback, useContext, useMemo, useState } from 'react';

interface Toast {
  id: number;
  message: string;
  variant: 'default' | 'error';
}

interface ToastApi {
  notify: (message: string) => void;
  notifyError: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, variant: Toast['variant']) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, variant }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 4000);
  }, []);

  const value = useMemo(
    () => ({
      notify: (message: string) => push(message, 'default'),
      notifyError: (message: string) => push(message, 'error'),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.variant === 'error' ? 'toast-error' : ''}`}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside <ToastProvider>');
  return context;
}
