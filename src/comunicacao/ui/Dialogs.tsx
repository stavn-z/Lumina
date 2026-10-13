import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, HelpCircle, Trash2 } from "lucide-react";

// Diálogos da área Comunicação, no mesmo visual das confirmações do Lumina
// (ex.: "Apagar Card"). Uso no estilo do uiAsk do protótipo:
//   await ask({ title, message, ok: 'Excluir', tone: 'danger' })          → true/false
//   await ask({ title, input: true, value, placeholder })                  → texto | null
//   await ask({ title, input: true, select: [['email','E-mail'], …] })     → { text, choice } | null
// Esc e clique fora cancelam. O Esc é tratado aqui antes de chegar na área (que fecharia tudo).

type Tone = 'default' | 'danger' | 'warning';

export interface AskOptions {
  title: string;
  message?: ReactNode;
  content?: ReactNode;
  input?: boolean;
  value?: string;
  placeholder?: string;
  inputLabel?: string;
  select?: [string, string][];
  selectValue?: string;
  selectLabel?: string;
  ok?: string;
  cancel?: string;
  noCancel?: boolean;
  tone?: Tone;
  icon?: ReactNode;
  wide?: boolean;
}

type AskFn = <R = any>(o: AskOptions) => Promise<R>;
const DialogCtx = createContext<AskFn>(async () => null as any);
export const useAsk = () => useContext(DialogCtx);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ id: number, o: AskOptions, resolve: (v: any) => void } | null>(null);
  const ask = useCallback<AskFn>((o) => new Promise(resolve => setState({ id: Date.now(), o, resolve })), []);
  return (
    <DialogCtx.Provider value={ask}>
      {children}
      {state && <AskDialog key={state.id} o={state.o} done={(v) => { setState(null); state.resolve(v); }} />}
    </DialogCtx.Provider>
  );
}

const TONE_ICON: Record<Tone, ReactNode> = {
  default: <HelpCircle size={24} />,
  danger: <Trash2 size={24} />,
  warning: <AlertTriangle size={24} />,
};
const TONE_COLOR: Record<Tone, string> = { default: 'text-indigo-400', danger: 'text-red-500', warning: 'text-amber-500' };
const TONE_BG: Record<Tone, string> = { default: 'bg-indigo-500/10', danger: 'bg-red-500/10', warning: 'bg-amber-500/10' };
const TONE_BTN: Record<Tone, string> = {
  default: 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/10',
  danger: 'bg-red-600 hover:bg-red-500 shadow-red-600/10',
  warning: 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/10',
};

export function AskDialog({ o, done }: { o: AskOptions, done: (v: any) => void }) {
  const tone = o.tone || 'default';
  const [text, setText] = useState(o.value || '');
  const [choice, setChoice] = useState(o.selectValue || (o.select ? o.select[0][0] : ''));
  const inputRef = useRef<HTMLInputElement>(null);
  const okRef = useRef<HTMLButtonElement>(null);
  const cancelValue = o.input ? null : false;
  const okValue = () => (o.input ? (o.select ? { text, choice } : text) : true);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    (o.input ? inputRef.current : okRef.current)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      done(cancelValue);
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); prev?.focus?.(); };
  }, []);

  const field = 'w-full bg-[var(--bg-primary)] border border-[var(--border-primary)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] outline-none focus:border-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500/40';

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center px-4 pt-4 pb-24 sm:p-4 z-[110] fade-in" onClick={() => done(cancelValue)}>
      <div role="dialog" aria-modal="true" aria-labelledby="com-ask-title" className={`w-full ${o.wide ? 'max-w-lg' : 'max-w-sm'} rounded-[32px] bg-[var(--bg-secondary)] border border-[var(--border-primary)] p-5 sm:p-8 shadow-2xl relative animate-modal-pop max-h-[85dvh] flex flex-col`} onClick={e => e.stopPropagation()}>
        <div className={`flex items-center gap-3 mb-4 ${TONE_COLOR[tone]}`}>
          <div className={`p-3 ${TONE_BG[tone]} rounded-2xl shadow-inner shrink-0`}>{o.icon || TONE_ICON[tone]}</div>
          <h3 id="com-ask-title" className="font-bold text-xl tracking-tight text-[var(--text-primary)] break-words min-w-0">{o.title}</h3>
        </div>
        {o.message && <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">{o.message}</p>}
        {o.content && <div className="mb-6 min-h-0 overflow-y-auto kp-scroll">{o.content}</div>}
        {o.input && (
          <form className="flex flex-col gap-3 mb-6" onSubmit={e => { e.preventDefault(); done(okValue()); }}>
            {o.select && (
              <label className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{o.selectLabel || 'Tipo'}</span>
                <select value={choice} onChange={e => setChoice(e.target.value)} className={field + ' cursor-pointer'}>
                  {o.select.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1.5">
              {o.inputLabel && <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{o.inputLabel}</span>}
              <input ref={inputRef} value={text} onChange={e => setText(e.target.value)} placeholder={o.placeholder} aria-label={o.inputLabel || o.title} className={field} />
            </label>
          </form>
        )}
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          {!o.noCancel && (
            <button type="button" onClick={() => done(cancelValue)} className="w-full sm:flex-1 py-3.5 sm:py-3 rounded-2xl border border-[var(--border-primary)] hover:bg-[var(--bg-overlay)] text-[var(--text-primary)] font-bold transition-all text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
              {o.cancel || 'Cancelar'}
            </button>
          )}
          <button ref={okRef} type="button" onClick={() => done(okValue())} className={`w-full sm:flex-1 py-3.5 sm:py-3 rounded-2xl text-white font-bold transition-all text-sm shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${TONE_BTN[tone]}`}>
            {o.ok || 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
}
