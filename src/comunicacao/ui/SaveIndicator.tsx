import { AlertTriangle, Check, Cloud, Loader2, RotateCcw } from "lucide-react";
import type { SaveStatus } from "../data/autosave.ts";

// Indicador "Salvando / Salvo / Erro ao salvar", no visual do selo "Sincronizado" do Lumina.
export function SaveIndicator({ status, error, onRetry }: { status: SaveStatus, error?: string, onRetry?: () => void }) {
  const base = 'inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md border shrink-0';
  return (
    <span role="status" aria-live="polite" className="inline-flex items-center gap-2">
      {status === 'saving' && <span className={`${base} text-indigo-400 bg-indigo-500/10 border-indigo-500/20`}><Loader2 size={10} className="animate-spin" /> Salvando…</span>}
      {status === 'saved' && <span className={`${base} text-[var(--accent-strong-emerald)] bg-emerald-500/10 border-emerald-500/20`}><Check size={10} /> Salvo</span>}
      {status === 'idle' && <span className={`${base} text-[var(--text-muted)] bg-[var(--bg-overlay)] border-[var(--border-overlay)]`}><Cloud size={10} /> Salvo</span>}
      {status === 'conflict' && <span className={`${base} text-amber-400 bg-amber-500/10 border-amber-500/20`}><AlertTriangle size={10} /> Alterado por outra pessoa</span>}
      {status === 'error' && (
        <>
          <span className={`${base} text-red-400 bg-red-500/10 border-red-500/20`} title={error}><AlertTriangle size={10} /> Erro ao salvar</span>
          {onRetry && (
            <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              <RotateCcw size={10} /> Tentar de novo
            </button>
          )}
        </>
      )}
    </span>
  );
}
