import { useEffect } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { fmtDate, rbState, TYPES } from "../lib/library.ts";
import { SaveIndicator } from "../ui/SaveIndicator.tsx";
import type { SaveStatus } from "../data/autosave.ts";
import type { TemplateRow } from "../types.ts";

// Partes comuns aos editores: cabeçalho, linha "Criado na Rubeus" e aviso de conflito.

export function EditorHeader({ row, nome, status, error, onRetry, actions }: {
  row: TemplateRow, nome: string, status: SaveStatus, error: string, onRetry: () => void, actions?: ReactNode,
}) {
  const edited = (row.history || []).some(h => h.kind === 'edit');
  return (
    <div className="flex flex-wrap items-start gap-3 pb-4 border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display font-bold text-lg text-[var(--text-primary)]">Editor de {TYPES[row.type]}</h3>
          <SaveIndicator status={status} error={error} onRetry={onRetry} />
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-1 break-words">
          Editando “{nome || 'Sem nome'}”. Salvo automaticamente. Criado em {fmtDate(row.created_at)}{edited ? ' · alterado em ' + fmtDate(row.updated_at) : ''}.
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function RubeusLine({ row, onToggle }: { row: TemplateRow, onToggle: () => void }) {
  const st = rbState(row);
  const cls = st === 'done'
    ? 'border-solid border-emerald-500/40 bg-emerald-500/10 text-[var(--accent-strong-emerald)]'
    : st === 'changed'
      ? 'border-solid border-orange-500/40 bg-orange-500/10 text-orange-400'
      : 'border-dashed border-[var(--border-hover)] text-[var(--text-secondary)] hover:border-emerald-500/60';
  const label = st === 'pending' ? 'Marcar como criado na Rubeus' : st === 'done' ? 'Criado na Rubeus' : 'Alterado após criar';
  const info = st === 'pending' ? 'Marque depois de cadastrar este template na Rubeus.' : st === 'done' ? 'em ' + fmtDate(row.rubeus_at) + ' · clique para desmarcar' : 'Atualize na Rubeus e clique para confirmar.';
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <button type="button" onClick={onToggle} className={`h-8 px-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${cls}`}>
        {st === 'done' ? <Check size={12} /> : st === 'changed' ? <AlertTriangle size={12} /> : null}{label}
      </button>
      <span className="text-xs text-[var(--text-muted)]">{info}</span>
    </div>
  );
}

/** Aviso de edição simultânea: nada é sobrescrito sem a pessoa escolher. */
export function ConflictDialog({ current, names, onLoadTheirs, onKeepMine, onSaveCopy, onDiscard }: {
  current: TemplateRow | null, names: Record<string, string>,
  onLoadTheirs: () => void, onKeepMine: () => void, onSaveCopy: () => void, onDiscard: () => void,
}) {
  // Esc não fecha: a pessoa precisa escolher o que fazer com a própria versão.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  const who = current?.updated_by ? (names[current.updated_by] || 'outra pessoa') : 'outra pessoa';
  const when = current ? new Date(current.updated_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  const btn = 'w-full py-3 rounded-2xl font-bold transition-all text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center px-4 pt-4 pb-24 sm:p-4 z-[115] fade-in">
      <div role="alertdialog" aria-modal="true" aria-labelledby="com-conflict-title" className="w-full max-w-md rounded-[32px] bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-5 sm:p-8 shadow-2xl animate-modal-pop">
        <div className="flex items-center gap-3 mb-4 text-amber-500">
          <div className="p-3 bg-amber-500/10 rounded-2xl shadow-inner"><AlertTriangle size={24} /></div>
          <h3 id="com-conflict-title" className="font-bold text-xl tracking-tight text-[var(--text-primary)]">{current ? 'Template alterado por outra pessoa' : 'Template excluído'}</h3>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          {current
            ? <>Este template foi alterado por <b className="text-[var(--text-primary)]">{who}</b> às {when}, enquanto você editava. Suas últimas alterações ainda não foram salvas. O que deseja fazer?</>
            : <>Este template foi excluído por outra pessoa enquanto você editava. Suas últimas alterações ainda não foram salvas.</>}
        </p>
        <div className="flex flex-col gap-2.5">
          {current ? (
            <>
              <button type="button" autoFocus onClick={onLoadTheirs} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}>Carregar a versão de {who}</button>
              <button type="button" onClick={onSaveCopy} className={`${btn} border border-[var(--border-primary)] hover:bg-[var(--bg-overlay)] text-[var(--text-primary)]`}>Salvar a minha como cópia</button>
              <button type="button" onClick={onKeepMine} className={`${btn} border border-red-500/30 text-red-400 hover:bg-red-500/10`}>Manter a minha (sobrescrever)</button>
            </>
          ) : (
            <>
              <button type="button" autoFocus onClick={onSaveCopy} className={`${btn} bg-indigo-600 hover:bg-indigo-500 text-white`}>Salvar a minha como novo template</button>
              <button type="button" onClick={onDiscard} className={`${btn} border border-red-500/30 text-red-400 hover:bg-red-500/10`}>Descartar minhas alterações</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
