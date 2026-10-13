import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Plus, Search } from "lucide-react";
import { fieldText, norm, rbState, SEARCH_FIELDS, SORT_OPTIONS, sortTemplates, STATUS_OPTIONS } from "../lib/library.ts";
import type { RbFilter, SortKey } from "../lib/library.ts";
import type { TemplateRow, TemplateType } from "../types.ts";
import { TemplateCard } from "./TemplateCard.tsx";

type TypeFilter = 'all' | TemplateType;
const TYPE_FILTERS: [TypeFilter, string][] = [['all', 'Todos'], ['email', 'E-mail'], ['sms', 'SMS'], ['whatsapp', 'WhatsApp']];

// Preferências de busca/ordenação lembradas por usuário neste navegador (como no protótipo).
function usePref<T extends string>(key: string, initial: T, allowed: readonly string[]) {
  const [v, setV] = useState<T>(() => {
    try { const s = localStorage.getItem(key); if (s && allowed.includes(s)) return s as T; } catch {}
    return initial;
  });
  useEffect(() => { try { localStorage.setItem(key, v); } catch {} }, [key, v]);
  return [v, setV] as const;
}

const selectCls = 'appearance-none bg-[var(--bg-secondary)] border border-[var(--border-primary)] rounded-xl pl-3 pr-8 h-10 text-xs font-semibold text-[var(--text-secondary)] outline-none cursor-pointer focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40';

export function LibraryTab({ userId, rows, loading, error, openId, onNew, onOpen, onDuplicate, onHistory, onDelete, onToggleRubeus }: {
  userId: string, rows: TemplateRow[], loading: boolean, error: string | null, openId: string | null,
  onNew: (defaultType: TemplateType) => void, onOpen: (r: TemplateRow) => void, onDuplicate: (r: TemplateRow) => void,
  onHistory: (r: TemplateRow) => void, onDelete: (r: TemplateRow) => void, onToggleRubeus: (r: TemplateRow) => void,
}) {
  const [field, setField] = usePref<string>(`lumina_com_lib_field:${userId}`, 'all', SEARCH_FIELDS.map(f => f[0]));
  const [sort, setSort] = usePref<SortKey>(`lumina_com_lib_sort:${userId}`, 'created', SORT_OPTIONS.map(f => f[0]));
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<RbFilter>('all');
  const [type, setType] = useState<TypeFilter>('all');

  const all = useMemo(() => rows.filter(r => type === 'all' || r.type === type), [rows, type]);
  const nq = norm(q.trim());
  const items = useMemo(
    () => sortTemplates(all, sort).filter(it => (status === 'all' || rbState(it) === status) && (!nq || norm(fieldText(it, field)).includes(nq))),
    [all, sort, status, nq, field],
  );
  const fieldLabel = (SEARCH_FIELDS.find(f => f[0] === field)?.[1] || '').toLowerCase();
  const plural = (n: number) => n + (n === 1 ? ' template' : ' templates');
  const count = nq ? `${items.length} de ${plural(all.length)} com “${q.trim()}” em ${fieldLabel}` : plural(all.length);

  return (
    <div className="flex flex-col gap-4 min-h-0">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="flex items-stretch flex-[1_1_320px] max-w-[460px] min-w-0 h-10 rounded-xl border overflow-hidden focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/30" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          <select value={field} onChange={e => setField(e.target.value)} aria-label="Campo da busca" className="bg-[var(--bg-overlay)] border-r border-[var(--border-primary)] px-2.5 text-xs font-semibold text-[var(--text-secondary)] outline-none cursor-pointer max-w-[45%]">
            {SEARCH_FIELDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Search size={14} className="self-center ml-3 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="contém…" aria-label="Texto da busca" className="flex-1 min-w-0 bg-transparent px-2.5 text-sm text-[var(--text-primary)] outline-none" />
        </div>
        <div className="relative">
          <select value={status} onChange={e => setStatus(e.target.value as RbFilter)} aria-label="Status na Rubeus" className={selectCls}>
            {STATUS_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
        </div>
        <div className="relative">
          <select value={sort} onChange={e => setSort(e.target.value as SortKey)} aria-label="Ordenar" className={selectCls}>
            {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
        </div>
        <span className="flex-1 hidden lg:block" />
        <div role="group" aria-label="Filtrar por tipo" className="flex gap-0.5 p-1 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          {TYPE_FILTERS.map(([v, l]) => (
            <button key={v} type="button" aria-pressed={type === v} onClick={() => setType(v)} className={`h-8 px-2.5 sm:px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${type === v ? 'bg-[var(--bg-overlay-strong)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={() => onNew(type === 'all' ? 'email' : type)} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)] outline-none focus-visible:ring-2 focus-visible:ring-indigo-300">
          <Plus size={14} /> Novo template
        </button>
      </div>

      {error && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>}
      {!error && !loading && <p className="text-xs text-[var(--text-muted)] -mt-1">{count}</p>}

      {loading ? (
        <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 animate-pulse py-10 text-center">Carregando templates…</p>
      ) : !rows.length ? (
        <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-4 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-primary)' }}>
          <h3 className="font-display font-bold text-base text-[var(--text-primary)]">Nenhum template ainda</h3>
          <p className="text-sm max-w-sm text-[var(--text-muted)]">Crie o primeiro template de e-mail, SMS ou WhatsApp. Ele fica disponível para toda a equipe.</p>
          <button type="button" onClick={() => onNew('email')} className="mt-1 h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"><Plus size={14} /> Criar template</button>
        </div>
      ) : !items.length ? (
        <p className="text-sm text-[var(--text-muted)] py-10 text-center">Nenhum template encontrado.</p>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 270px), 1fr))' }}>
          {items.map(r => (
            <TemplateCard
              key={r.id}
              row={r}
              editing={r.id === openId}
              onOpen={() => onOpen(r)}
              onDuplicate={() => onDuplicate(r)}
              onHistory={() => onHistory(r)}
              onDelete={() => onDelete(r)}
              onToggleRubeus={() => onToggleRubeus(r)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
