import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, Copy, Plus, X } from "lucide-react";
import { useAsk } from "../ui/Dialogs.tsx";
import { useToast } from "../ui/Toast.tsx";
import type { KeyValue } from "../types.ts";

// Peças de formulário dos editores, no visual do Lumina (tokens do tema, Tailwind).

export const inputCls = 'w-full min-w-0 bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-3.5 py-2.5 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/30 placeholder:text-[var(--text-muted)]';
export const miniBtn = 'h-9 px-3 rounded-lg border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 inline-flex items-center justify-center gap-1.5 shrink-0 disabled:opacity-40';
export const xBtn = 'h-9 w-9 grid place-items-center rounded-lg border border-[var(--border-primary)] text-[var(--text-muted)] hover:text-red-400 hover:border-red-500/40 hover:bg-red-500/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 shrink-0';

export async function copyText(txt: string) {
  try { await navigator.clipboard.writeText(txt); return true; } catch {}
  const ta = document.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch {}
  ta.remove(); return ok;
}

export function Section({ title, dot, open = true, aside, children }: { title: string, dot: string, open?: boolean, aside?: ReactNode, children: ReactNode }) {
  return (
    <details open={open} className="group border-b" style={{ borderColor: 'var(--border-primary)' }}>
      <summary className="list-none [&::-webkit-details-marker]:hidden flex items-center gap-2.5 py-4 cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot, boxShadow: `0 0 8px ${dot}` }} />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">{title}</span>
        {aside && <span className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-muted)]">{aside}</span>}
        <ChevronDown size={14} className="ml-auto text-[var(--text-muted)] transition-transform group-open:rotate-180" />
      </summary>
      <div className="flex flex-col gap-3.5 pb-5">{children}</div>
    </details>
  );
}

export function Field({ label, children, hint }: { label: string, children: ReactNode, hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--text-muted)] leading-relaxed">{hint}</span>}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs leading-relaxed text-[var(--text-muted)] [&_code]:font-mono [&_code]:text-[11px] [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:bg-[var(--bg-overlay-strong)] [&_code]:text-[var(--text-secondary)] [&_strong]:text-[var(--text-secondary)]">{children}</p>;
}

export function Select({ value, onChange, options, label }: { value: string, onChange: (v: string) => void, options: [string, string][], label?: string }) {
  return (
    <div className="relative">
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)} className={inputCls + ' appearance-none pr-9 cursor-pointer'}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
    </div>
  );
}

export function Check2({ checked, onChange, children }: { checked: boolean, onChange: (v: boolean) => void, children: ReactNode }) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-[var(--text-secondary)] cursor-pointer select-none">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-indigo-600 cursor-pointer" />
      {children}
    </label>
  );
}

/** Cor com seletor e código hex (aceita #abc e #aabbcc), como no protótipo. */
export function ColorField({ value, onChange }: { value: string, onChange: (v: string) => void }) {
  const [text, setText] = useState(value || '');
  useEffect(() => { setText(value || ''); }, [value]);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <input type="color" aria-label="Escolher cor" value={/^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'} onChange={e => onChange(e.target.value)} className="w-10 h-10 shrink-0 rounded-lg border border-[var(--border-primary)] bg-transparent cursor-pointer p-0.5" />
      <input spellCheck={false}
        type="text" aria-label="Código da cor" maxLength={7} value={text}
        onChange={e => { setText(e.target.value); let v = e.target.value.trim(); if (v && v[0] !== '#') v = '#' + v; if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onChange(v); }}
        className={inputCls + ' font-mono'}
      />
    </div>
  );
}

export function CopyButton({ value, label = 'Copiar', ariaLabel }: { value: string, label?: string, ariaLabel?: string }) {
  const toast = useToast();
  const [done, setDone] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={async () => {
        if (!value) { toast('Campo vazio'); return; }
        if (await copyText(value)) { setDone(true); clearTimeout(t.current); t.current = setTimeout(() => setDone(false), 1600); }
        else toast('Não foi possível copiar automaticamente');
      }}
      className={`h-8 px-2.5 rounded-lg border text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-1.5 shrink-0 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${done ? 'border-emerald-500/40 text-[var(--accent-strong-emerald)] bg-emerald-500/10' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]'}`}
    >
      {done ? <Check size={12} /> : <Copy size={12} />}{done ? 'Copiado' : label}
    </button>
  );
}

function nextLinkKey(arr: KeyValue[]) { const ks = new Set(arr.map(l => l.k)); if (!ks.has('link')) return 'link'; let n = 2; while (ks.has('link' + n)) n++; return 'link' + n; }

/** Linhas de variáveis ({1} = valor) ou de links ([link] = endereço), com confirmação ao remover. */
export function KeyValueRows({ kind, items, onChange }: { kind: 'vars' | 'links', items: KeyValue[], onChange: (next: KeyValue[]) => void }) {
  const ask = useAsk();
  const listRef = useRef<HTMLDivElement>(null);
  const [focusLast, setFocusLast] = useState(false);
  const [editingKey, setEditingKey] = useState<number | null>(null);
  const isLink = kind === 'links';

  useEffect(() => {
    if (!focusLast) return;
    const ins = listRef.current?.querySelectorAll<HTMLInputElement>('input[data-val]');
    ins?.[ins.length - 1]?.focus();
    setFocusLast(false);
  }, [focusLast]);

  const set = (i: number, patch: Partial<KeyValue>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const add = () => {
    if (isLink) onChange([...items, { k: nextLinkKey(items), v: '' }]);
    else { const nums = items.map(v => parseInt(v.k, 10)).filter(n => !isNaN(n)); onChange([...items, { k: String(nums.length ? Math.max(...nums) + 1 : 1), v: '' }]); }
    setFocusLast(true);
  };
  const remove = async (i: number) => {
    const it = items[i];
    const ok = isLink
      ? await ask({ title: 'Remover link?', message: '[' + it.k + '] deixará de ter endereço neste template.', ok: 'Remover', tone: 'danger' })
      : await ask({ title: 'Remover variável?', message: '{' + it.k + '} deixará de ser trocada neste template.', ok: 'Remover', tone: 'danger' });
    if (ok) onChange(items.filter((_, j) => j !== i));
  };

  return (
    <div className="flex flex-col gap-2">
      <div ref={listRef} className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-[minmax(64px,96px)_auto_minmax(0,1fr)_auto] items-center gap-2">
            <input spellCheck={false}
              aria-label={isLink ? 'Nome do link' : 'Número da variável'}
              value={isLink && editingKey !== i ? '[' + it.k + ']' : it.k}
              onFocus={() => setEditingKey(i)}
              onBlur={() => setEditingKey(null)}
              onChange={e => set(i, { k: isLink ? e.target.value.replace(/[[\]\s]/g, '').toLowerCase() : e.target.value.replace(/[{}\s]/g, '') })}
              className={inputCls + ' font-mono text-center ' + (isLink ? 'text-sky-500' : 'text-pink-500')}
            />
            <span className="text-[var(--text-muted)] font-bold">=</span>
            <input spellCheck={false} data-val aria-label={isLink ? 'Endereço do link' : 'Valor da variável'} value={it.v || ''} placeholder={isLink ? 'https://www.rubeus.com.br/' : '@@nome_da_pessoa@@'} onChange={e => set(i, { v: isLink ? e.target.value.trim() : e.target.value })} className={inputCls} />
            <button type="button" aria-label={isLink ? 'Remover link' : 'Remover variável'} onClick={() => remove(i)} className={xBtn}><X size={14} /></button>
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="h-10 rounded-xl border border-dashed border-[var(--border-hover)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-indigo-400 hover:border-indigo-500/50 transition-colors inline-flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <Plus size={12} /> {isLink ? 'Novo link' : 'Nova variável'}
      </button>
    </div>
  );
}

export function DashedAdd({ onClick, children, hidden }: { onClick: () => void, children: ReactNode, hidden?: boolean }) {
  if (hidden) return null;
  return (
    <button type="button" onClick={onClick} className="h-10 rounded-xl border border-dashed border-[var(--border-hover)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-indigo-400 hover:border-indigo-500/50 transition-colors inline-flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
      <Plus size={12} /> {children}
    </button>
  );
}
