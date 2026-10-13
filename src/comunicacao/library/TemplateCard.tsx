import { Check, Copy, History, X } from "lucide-react";
import { fmtDate, rbState, TYPES } from "../lib/library.ts";
import type { RbState } from "../lib/library.ts";
import type { TemplateRow } from "../types.ts";
import { Thumb } from "./Thumb.tsx";

export const TYPE_BADGE: Record<string, string> = {
  email: 'bg-indigo-500/10 text-indigo-400',
  sms: 'bg-orange-500/10 text-orange-400',
  whatsapp: 'bg-emerald-500/10 text-[var(--accent-strong-emerald)]',
};
export const RB_BADGE: Record<RbState, [string, string]> = {
  done: ['Na Rubeus', 'bg-emerald-500/10 text-[var(--accent-strong-emerald)]'],
  changed: ['Alterado', 'bg-orange-500/10 text-orange-400'],
  pending: ['Pendente', 'bg-[var(--bg-overlay-strong)] text-[var(--text-muted)]'],
};

export function rbText(it: TemplateRow, st: RbState) {
  return st === 'pending' ? 'Marcar como criado na Rubeus' : st === 'done' ? 'Criado na Rubeus em ' + fmtDate(it.rubeus_at) : 'Alterado após criar · marcar como atualizado';
}

const badge = 'px-1.5 py-0.5 rounded-[5px] text-[10px] font-bold uppercase tracking-[0.08em]';
const mini = 'h-8 px-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 inline-flex items-center gap-1.5';

export function TemplateCard({ row, editing, onOpen, onDuplicate, onHistory, onDelete, onToggleRubeus }: {
  row: TemplateRow, editing: boolean,
  onOpen: () => void, onDuplicate: () => void, onHistory: () => void, onDelete: () => void, onToggleRubeus: () => void,
}) {
  const st = rbState(row);
  const edits = (row.history || []).filter(h => h.kind === 'edit').length;
  const nome = row.data.nome || 'Sem nome';
  const rbCls = st === 'done'
    ? 'border-solid border-emerald-500/40 bg-emerald-500/10 text-[var(--accent-strong-emerald)]'
    : st === 'changed'
      ? 'border-solid border-orange-500/40 bg-orange-500/10 text-orange-400'
      : 'border-dashed border-[var(--border-hover)] text-[var(--text-secondary)] hover:border-emerald-500/60';

  return (
    <article className={`rounded-2xl overflow-hidden flex flex-col border transition-all ${editing ? 'border-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.2)]' : 'hover:border-[var(--border-hover)] hover:shadow-lg'}`} style={{ background: 'var(--bg-secondary)', borderColor: editing ? undefined : 'var(--border-primary)' }}>
      <button type="button" onClick={onOpen} aria-label={'Abrir ' + nome} className="block w-full text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500">
        <Thumb row={row} />
      </button>
      <div className="px-3.5 pt-3 pb-1.5 grid gap-1 min-w-0">
        <span className="font-mono text-xs font-bold truncate text-[var(--text-primary)]" title={nome}>{nome}</span>
        <span className="text-xs truncate text-[var(--text-secondary)]">{row.data.assunto || 'Sem assunto'}</span>
        <span className="flex items-center gap-1.5 flex-wrap mt-1">
          <span className={`${badge} ${TYPE_BADGE[row.type]}`}>{TYPES[row.type]}</span>
          <span className={`${badge} ${RB_BADGE[st][1]}`}>{RB_BADGE[st][0]}</span>
          {editing && <span className={`${badge} bg-indigo-500/15 text-indigo-400`}>Editando</span>}
        </span>
        <span className="text-[11px] leading-snug text-[var(--text-muted)]">Criado em {fmtDate(row.created_at)}</span>
        <span className="text-[11px] leading-snug text-[var(--text-muted)]">{edits ? `Alterado ${fmtDate(row.updated_at)} · ${edits} ${edits === 1 ? 'alteração' : 'alterações'}` : 'Sem alterações'}</span>
      </div>
      <button
        type="button"
        onClick={onToggleRubeus}
        title={st === 'done' ? 'Clique para desmarcar' : st === 'changed' ? 'Clique depois de atualizar na Rubeus' : 'Clique depois de criar na Rubeus'}
        className={`mx-3.5 mt-0.5 flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs font-semibold text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${rbCls}`}
      >
        <span className="w-4 h-4 rounded-[5px] border-2 border-current grid place-items-center shrink-0 text-[11px] leading-none">{st === 'done' ? <Check size={10} strokeWidth={3} /> : st === 'changed' ? '!' : ''}</span>
        <span className="min-w-0">{rbText(row, st)}</span>
      </button>
      <div className="flex flex-wrap items-center gap-1.5 px-3.5 pt-2 pb-3.5 mt-auto">
        <button type="button" onClick={onOpen} className={`${mini} bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-500`}>Abrir</button>
        <button type="button" onClick={onDuplicate} className={`${mini} border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]`}><Copy size={12} />Duplicar</button>
        <button type="button" onClick={onHistory} className={`${mini} border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]`}><History size={12} />Histórico</button>
        <button type="button" onClick={onDelete} aria-label={'Excluir ' + nome} title="Excluir template" className="ml-auto h-8 w-8 grid place-items-center rounded-lg border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><X size={14} /></button>
      </div>
    </article>
  );
}
