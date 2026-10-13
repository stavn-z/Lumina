import { useEffect, useRef, useState } from "react";
import { AutosaveController } from "./autosave.ts";
import type { SaveOutcome, SaveStatus } from "./autosave.ts";

/**
 * Salvamento automático com atraso. `key` identifica o que está sendo editado
 * (ex.: id do template): ao trocar a key ou desmontar, o pendente é salvo na hora.
 * Enquanto houver algo não salvo, o navegador avisa antes de recarregar/fechar.
 */
export function useAutosave<T>(key: string | null, save: (v: T) => Promise<SaveOutcome>, delay = 800) {
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState('');
  const saveRef = useRef(save);
  saveRef.current = save;
  const ctrlRef = useRef<AutosaveController<T> | null>(null);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AutosaveController<T>(v => saveRef.current(v), (s, e) => { setStatus(s); setError(e); }, delay);
    ctrlRef.current = ctrl;
    setStatus('idle');
    setError('');
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!ctrl.dirty) return;
      void ctrl.flush();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      void ctrl.flush();
      ctrl.dispose();
      if (ctrlRef.current === ctrl) ctrlRef.current = null;
    };
  }, [key, delay]);

  return {
    status,
    error,
    change: (v: T) => ctrlRef.current?.change(v),
    flush: () => ctrlRef.current?.flush() ?? Promise.resolve(),
    retry: () => ctrlRef.current?.retry() ?? Promise.resolve(),
    resolveConflict: (keepPending: boolean) => ctrlRef.current?.resolveConflict(keepPending),
    discard: () => ctrlRef.current?.discard(),
    isDirty: () => !!ctrlRef.current?.dirty,
  };
}
