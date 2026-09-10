import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastType = 'success' | 'info' | 'error' | 'warning';

interface Toast {
  id: number;
  type: ToastType;
  title: string;
  sub?: string;
  duration: number;
}

interface ToastApi {
  push: (type: ToastType, title: string, sub?: string, duration?: number) => void;
  success: (title: string, sub?: string) => void;
  info: (title: string, sub?: string) => void;
  warning: (title: string, sub?: string) => void;
  error: (title: string, sub?: string) => void;
}

const ToastCtx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastCtx);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>');
  return api;
}

const DEFAULT_DURATION: Record<ToastType, number> = {
  success: 2500,
  info: 3000,
  warning: 3500,
  error: 4000,
};

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
};

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) { window.clearTimeout(t); timers.current.delete(id); }
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback((type: ToastType, title: string, sub?: string, duration?: number) => {
    const id = nextId++;
    const d = duration ?? DEFAULT_DURATION[type];
    setToasts((prev) => [...prev.slice(-2), { id, type, title, sub, duration: d }]);
    if (!document.hidden) {
      timers.current.set(id, window.setTimeout(() => dismiss(id), d));
    } else {
      // вкладка скрыта — показать при возврате
      const onVis = () => {
        if (!document.hidden) {
          document.removeEventListener('visibilitychange', onVis);
          timers.current.set(id, window.setTimeout(() => dismiss(id), d));
        }
      };
      document.addEventListener('visibilitychange', onVis);
    }
  }, [dismiss]);

  const api: ToastApi = {
    push,
    success: (title, sub) => push('success', title, sub),
    info: (title, sub) => push('info', title, sub),
    warning: (title, sub) => push('warning', title, sub),
    error: (title, sub) => push('error', title, sub),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite">
          <AnimatePresence>
            {toasts.map((t) => {
              const Icon = ICONS[t.type];
              return (
                <motion.div
                  key={t.id}
                  className={`toast toast-${t.type}`}
                  role={t.type === 'error' ? 'alert' : 'status'}
                  initial={{ opacity: 0, y: -12, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  onMouseEnter={() => {
                    const h = timers.current.get(t.id);
                    if (h !== undefined) { window.clearTimeout(h); timers.current.delete(t.id); }
                  }}
                  onMouseLeave={() => {
                    timers.current.set(t.id, window.setTimeout(() => dismiss(t.id), 1500));
                  }}
                >
                  <Icon size={18} className="toast-ico" />
                  <div className="toast-body">
                    <b>{t.title}</b>
                    {t.sub && <span>{t.sub}</span>}
                  </div>
                  <button type="button" className="toast-x" onClick={() => dismiss(t.id)} aria-label="Закрыть">
                    <X size={14} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>,
        document.body,
      )}
      <style>{`
        .toast-stack{
          position:fixed; top:calc(12px + env(safe-area-inset-top, 0px)); right:12px; z-index:90;
          display:flex; flex-direction:column; gap:8px; pointer-events:none;
          width:min(360px, calc(100vw - 24px));
        }
        @media (max-width:640px){
          .toast-stack{ left:12px; right:12px; width:auto; }
        }
        .toast{
          display:flex; gap:10px; align-items:flex-start; padding:11px 12px; border-radius:12px;
          background:rgba(13,21,38,.94); border:1px solid rgba(59,130,246,.3);
          backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px);
          box-shadow:0 12px 40px rgba(0,0,0,.5); pointer-events:auto;
          font-family:'Open Sans',sans-serif;
        }
        .toast-ico{ flex-shrink:0; margin-top:1px; }
        .toast-success{ border-color:rgba(34,197,94,.45); } .toast-success .toast-ico{ color:#22C55E; }
        .toast-info{ border-color:rgba(59,130,246,.45); } .toast-info .toast-ico{ color:#60A5FA; }
        .toast-warning{ border-color:rgba(251,191,36,.45); } .toast-warning .toast-ico{ color:#FBBF24; }
        .toast-error{ border-color:rgba(239,68,68,.45); } .toast-error .toast-ico{ color:#F87171; }
        .toast-body{ flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }
        .toast-body b{ font-size:12.5px; color:#fff; }
        .toast-body span{ font-size:11.5px; color:var(--muted); line-height:1.45; }
        .toast-x{ background:none; border:none; color:var(--muted); cursor:pointer; padding:2px; flex-shrink:0; }
        .toast-x:hover{ color:#fff; }
      `}</style>
    </ToastCtx.Provider>
  );
}
