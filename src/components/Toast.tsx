import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

interface ToastContextType {
  toast: {
    success: (message: string) => void;
    error: (message: string) => void;
    warning: (message: string) => void;
    info: (message: string) => void;
  };
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const TOAST_ICONS = {
  success: CheckCircle2,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const TOAST_STYLES = {
  success: 'bg-emerald-50 border-emerald-200 text-emerald-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
};

const TOAST_ICON_STYLES = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
};

const CONFIRM_STYLES = {
  danger: 'bg-red-600 hover:bg-red-700 shadow-red-200',
  warning: 'bg-amber-600 hover:bg-amber-700 shadow-amber-200',
  info: 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200',
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const idRef = useRef(0);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => addToast('success', msg),
    error: (msg: string) => addToast('error', msg),
    warning: (msg: string) => addToast('warning', msg),
    info: (msg: string) => addToast('info', msg),
  };

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const handleConfirmResponse = (value: boolean) => {
    confirmState?.resolve(value);
    setConfirmState(null);
  };

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map(t => {
            const Icon = TOAST_ICONS[t.type];
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: 80, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 80, scale: 0.95 }}
                transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm ${TOAST_STYLES[t.type]}`}
              >
                <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${TOAST_ICON_STYLES[t.type]}`} />
                <p className="text-sm font-medium flex-1 leading-relaxed">{t.message}</p>
                <button
                  onClick={() => removeToast(t.id)}
                  className="shrink-0 p-0.5 rounded-md hover:bg-black/5 transition-colors"
                >
                  <X className="w-3.5 h-3.5 opacity-50" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmState && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => handleConfirmResponse(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[210]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-[220] overflow-hidden"
            >
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    confirmState.type === 'danger' ? 'bg-red-100' : confirmState.type === 'warning' ? 'bg-amber-100' : 'bg-indigo-100'
                  }`}>
                    <AlertTriangle className={`w-5 h-5 ${
                      confirmState.type === 'danger' ? 'text-red-600' : confirmState.type === 'warning' ? 'text-amber-600' : 'text-indigo-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{confirmState.title}</h3>
                    <p className="text-sm text-slate-500 mt-1 leading-relaxed">{confirmState.message}</p>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 px-6 pb-6">
                <button
                  onClick={() => handleConfirmResponse(false)}
                  className="flex-1 py-2.5 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  {confirmState.cancelText || 'Hủy bỏ'}
                </button>
                <button
                  onClick={() => handleConfirmResponse(true)}
                  className={`flex-1 py-2.5 text-sm font-semibold text-white rounded-xl shadow-md transition-all ${
                    CONFIRM_STYLES[confirmState.type || 'info']
                  }`}
                >
                  {confirmState.confirmText || 'Xác nhận'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used within a ToastProvider');
  return context;
};
