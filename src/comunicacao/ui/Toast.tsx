import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

// Toast da área Comunicação (o Lumina não tem um). Uma mensagem por vez, com ação
// opcional (ex.: "Desfazer"); some sozinho em 2,2 s, ou 5 s quando tem ação.

interface ToastAction { label: string, run: () => void }
interface ToastState { id: number, msg: string, action?: ToastAction }

const ToastCtx = createContext<(msg: string, action?: ToastAction) => void>(() => {});

export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const show = useCallback((msg: string, action?: ToastAction) => {
    clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, msg, action });
    timer.current = setTimeout(() => setToast(t => (t && t.id === id ? null : t)), action ? 5000 : 2200);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div role="status" aria-live="polite" className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[130] w-[calc(100%-32px)] max-w-md pointer-events-none flex justify-center">
        {toast && (
          <div key={toast.id} className="pointer-events-auto flex items-center gap-3 pl-4 pr-2 py-2 min-h-11 rounded-2xl shadow-2xl border text-sm font-medium animate-modal-pop" style={{ background: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)', color: 'var(--text-primary)' }}>
            <span className="py-1">{toast.msg}</span>
            {toast.action && (
              <button
                type="button"
                onClick={() => { const a = toast.action!; setToast(null); a.run(); }}
                className="shrink-0 px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest text-indigo-400 hover:bg-indigo-500/10 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastCtx.Provider>
  );
}
