import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Copy, Eraser, Pencil, Plus, Trash2, Wand2, X } from "lucide-react";
import { clone, DEF_LISTS, normalizeLists, TAX_KEYS } from "../defaults.ts";
import { createClient, deleteClient, saveClient } from "../data/taxonomyApi.ts";
import { errorText } from "../data/supa.ts";
import { useAutosave } from "../data/useAutosave.ts";
import { build, initialSel, LABELS, sanitizeSel, sig, SINGLE } from "../lib/taxonomy.ts";
import type { TaxSel } from "../lib/taxonomy.ts";
import { copyText, Field, Hint, inputCls, miniBtn, Section, xBtn } from "../editor/parts.tsx";
import { useAsk } from "../ui/Dialogs.tsx";
import { SaveIndicator } from "../ui/SaveIndicator.tsx";
import { useToast } from "../ui/Toast.tsx";
import type { TaxClientRow, TaxLists } from "../types.ts";

// Aba Taxonomia — port do segundo bloco do protótipo. Os clientes e cadastros ficam no
// banco (compartilhados); o que está selecionado no formulário e os nomes recentes ficam
// no navegador de cada pessoa, para ninguém atrapalhar a digitação de outro.

interface LocalState { cur: string, sels: Record<string, TaxSel>, recent: string[] }

function useLocalTax(userId: string) {
  const key = `lumina_com_tax:${userId}`;
  const [st, setSt] = useState<LocalState>(() => {
    try { const v = JSON.parse(localStorage.getItem(key) || 'null'); if (v && typeof v === 'object') return { cur: v.cur || 'celso', sels: v.sels || {}, recent: Array.isArray(v.recent) ? v.recent : [] }; } catch {}
    return { cur: 'celso', sels: {}, recent: [] };
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(st)); } catch {} }, [key, st]);
  return [st, setSt] as const;
}

export function TaxonomyTab({ userId, clients: rawClients, loading, error, upsertLocal, removeLocal, onUseName }: {
  userId: string, clients: TaxClientRow[], loading: boolean, error: string | null,
  upsertLocal: (r: TaxClientRow) => void, removeLocal: (id: string) => void,
  onUseName: (name: string) => Promise<boolean>,
}) {
  const ask = useAsk();
  const toast = useToast();
  const [st, setSt] = useLocalTax(userId);
  // Ordem de cadastro, como no protótipo (clientes novos vão para o fim da lista).
  const clients = useMemo(() => [...rawClients].sort((a, b) => a.created_at.localeCompare(b.created_at)), [rawClients]);
  const client = clients.find(c => c.id === st.cur) || clients[0] || null;

  if (loading) return <p className="text-xs font-bold uppercase tracking-widest text-indigo-400 animate-pulse py-10 text-center">Carregando taxonomia…</p>;
  if (error) return <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3">{error}</p>;
  if (!client) return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="text-sm text-[var(--text-muted)]">Nenhum cliente cadastrado.</p>
      <button type="button" className={miniBtn} onClick={async () => {
        const name = ((await ask<string | null>({ title: 'Novo cliente', input: true, placeholder: 'Ex.: Mackenzie', ok: 'Criar' })) || '').trim();
        if (!name) return;
        try { const c = await createClient({ name, lists: clone(DEF_LISTS) }); upsertLocal(c); setSt(s => ({ ...s, cur: c.id })); } catch (e) { toast('Não foi possível criar o cliente: ' + errorText(e)); }
      }}><Plus size={12} />Novo cliente</button>
    </div>
  );
  return <ClientTaxonomy key={client.id} {...{ userId, clients, client, st, setSt, upsertLocal, removeLocal, onUseName }} />;
}

function ClientTaxonomy({ clients, client, st, setSt, upsertLocal, removeLocal, onUseName }: {
  userId: string, clients: TaxClientRow[], client: TaxClientRow, st: LocalState, setSt: (fn: (s: LocalState) => LocalState) => void,
  upsertLocal: (r: TaxClientRow) => void, removeLocal: (id: string) => void, onUseName: (name: string) => Promise<boolean>,
}) {
  const ask = useAsk();
  const toast = useToast();

  // ---- cadastros (banco, com salvamento automático e controle de versão) ----
  const [lists, setLists] = useState<TaxLists>(() => clone(client.lists));
  const listsRef = useRef(lists);
  const baseRef = useRef(client);
  const saveLists = useCallback(async (l: TaxLists) => {
    let res = await saveClient(baseRef.current, { lists: l });
    if (res.status === 'conflict' && res.current && JSON.stringify(res.current.lists) === JSON.stringify(baseRef.current.lists)) {
      baseRef.current = res.current; // só o nome mudou: reaplica
      res = await saveClient(res.current, { lists: l });
    }
    if (res.status === 'conflict') {
      const cur = res.current;
      if (!cur) { toast('Este cliente foi excluído por outra pessoa'); return 'ok' as const; }
      const keepMine = await ask({ title: 'Cadastros alterados por outra pessoa', message: `Os cadastros de ${cur.name} mudaram enquanto você editava. Manter os seus substitui as alterações da outra pessoa.`, ok: 'Manter os meus', cancel: 'Carregar os dela', tone: 'warning' });
      baseRef.current = cur;
      if (keepMine) { res = await saveClient(cur, { lists: l }); if (res.status !== 'ok') return 'conflict' as const; }
      else { const fresh = clone(cur.lists); listsRef.current = fresh; setLists(fresh); upsertLocal(cur); return 'ok' as const; }
    }
    baseRef.current = res.row;
    upsertLocal(res.row);
    return 'ok' as const;
  }, [ask, toast, upsertLocal]);
  const autosave = useAutosave<TaxLists>(client.id, saveLists);

  // Versão nova vinda do banco (outra pessoa) quando não há nada pendente aqui.
  useEffect(() => {
    if (client.rev <= baseRef.current.rev || autosave.isDirty()) return;
    baseRef.current = client;
    const fresh = clone(client.lists); listsRef.current = fresh; setLists(fresh);
  }, [client]); // só reage a uma nova versão do cliente

  const editLists = (fn: (l: TaxLists) => void) => {
    const next = clone(listsRef.current); fn(next); listsRef.current = next; setLists(next); autosave.change(next);
  };

  // ---- seleção do formulário (navegador) ----
  const rawSel = st.sels[client.id] || initialSel(client.id);
  const sel = useMemo(() => sanitizeSel(rawSel, lists), [rawSel, lists]);
  const setSel = (patch: Partial<TaxSel>) => setSt(s => ({ ...s, sels: { ...s.sels, [client.id]: { ...sel, ...patch } } }));
  const { name, parts } = build(sel);
  const camp = sel.mode === 'campanha';
  const remember = (n: string) => setSt(s => ({ ...s, recent: [n, ...s.recent.filter(x => x !== n)].slice(0, 8) }));

  const [regTab, setRegTab] = useState<keyof TaxLists>('centro');
  const [copied, setCopied] = useState(false);
  const [focusNew, setFocusNew] = useState(false);
  const rowsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusNew) return;
    const ins = rowsRef.current?.querySelectorAll<HTMLInputElement>('input[aria-label="Nome da opção"]');
    ins?.[ins.length - 1]?.focus(); setFocusNew(false);
  }, [focusNew]);

  async function newClient() {
    const n = ((await ask<string | null>({ title: 'Novo cliente', input: true, placeholder: 'Ex.: Mackenzie', ok: 'Continuar' })) || '').trim();
    if (!n) return;
    const base = await ask({ title: 'Cadastros de ' + n, message: `Quer começar com uma cópia dos cadastros de ${client.name} ou em branco?`, ok: 'Copiar cadastros', cancel: 'Começar em branco' });
    const l: TaxLists = base ? clone(listsRef.current) : normalizeLists({});
    try {
      await autosave.flush();
      const c = await createClient({ name: n, lists: l });
      upsertLocal(c);
      setSt(s => ({ ...s, cur: c.id }));
      toast('Cliente ' + n + ' criado');
    } catch (e) { toast('Não foi possível criar o cliente: ' + errorText(e)); }
  }

  async function rename() {
    const n = ((await ask<string | null>({ title: 'Renomear cliente', input: true, value: client.name, ok: 'Salvar' })) || '').trim();
    if (!n || n === client.name) return;
    try {
      await autosave.flush();
      let res = await saveClient(baseRef.current, { name: n });
      if (res.status === 'conflict' && res.current) res = await saveClient(res.current, { name: n });
      if (res.status === 'ok') { baseRef.current = res.row; upsertLocal(res.row); } else toast('Este cliente não existe mais');
    } catch (e) { toast('Não foi possível renomear: ' + errorText(e)); }
  }

  async function remove() {
    if (clients.length <= 1) { toast('É preciso manter pelo menos um cliente'); return; }
    if (!await ask({ title: 'Excluir cliente?', message: `O cliente ${client.name} e todos os cadastros dele serão apagados para toda a equipe.`, ok: 'Excluir', tone: 'danger' })) return;
    try {
      autosave.discard();
      await deleteClient(client.id);
      removeLocal(client.id);
      const next = clients.find(c => c.id !== client.id)!;
      setSt(s => { const sels = { ...s.sels }; delete sels[client.id]; return { ...s, cur: next.id, sels }; });
    } catch (e) { toast('Não foi possível excluir: ' + errorText(e)); }
  }

  async function clearFields() {
    if (!await ask({ title: 'Limpar campos?', message: 'Modalidade, número, datas e oferta serão apagados.', ok: 'Limpar', tone: 'warning' })) return;
    setSel({ modalidade: [], num: '', ini: '', fim: '', disp: '', oferta: '' });
  }

  async function copyName() {
    if (!name) return;
    if (await copyText(name)) { remember(name); setCopied(true); setTimeout(() => setCopied(false), 1500); }
    else toast('Não foi possível copiar automaticamente');
  }

  async function useName() {
    if (!name) return;
    remember(name);
    await onUseName(name);
  }

  async function removeOption(i: number) {
    const list = listsRef.current[regTab]; const o = list[i];
    if ((SINGLE as readonly string[]).includes(regTab) && list.length <= 1) { toast('Mantenha pelo menos uma opção neste campo'); return; }
    if (!await ask({ title: 'Excluir opção?', message: `“${o.l || o.c || 'Opção sem nome'}” sairá dos cadastros de ${client.name}.`, ok: 'Excluir', tone: 'danger' })) return;
    editLists(l => { l[regTab].splice(i, 1); });
  }

  function setSigla(i: number, raw: string) {
    const old = listsRef.current[regTab][i].c; const c = sig(raw);
    editLists(l => { l[regTab][i].c = c; });
    if (regTab === 'modalidade') setSel({ modalidade: sel.modalidade.map(v => (v === old ? c : v)) });
    else if ((sel as any)[regTab] === old) setSel({ [regTab]: c } as Partial<TaxSel>);
  }

  const seg = (on: boolean) => `h-9 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${on ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`;
  const card = 'rounded-2xl border p-4 sm:p-5';
  const cardStyle = { background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' };
  const opt = (on: boolean) => `flex items-center gap-2 px-3 h-9 rounded-xl border text-sm cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-500 ${on ? 'border-indigo-500 bg-indigo-500/10 text-[var(--text-primary)]' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'}`;

  const listSelect = (k: keyof TaxLists) => (
    <Field key={k} label={LABELS[k]}>
      <div className="relative">
        <select value={(sel as any)[k]} onChange={e => setSel({ [k]: e.target.value } as Partial<TaxSel>)} className={inputCls + ' appearance-none pr-9 cursor-pointer'}>
          {lists[k].length ? lists[k].map(o => <option key={o.c + o.l} value={o.c}>{o.l} ({o.c})</option>) : <option value="">Cadastre opções em Cadastros</option>}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
      </div>
    </Field>
  );

  return (
    <div className="flex-1 min-h-0 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-6 flex flex-col gap-5">
      {/* FORMULÁRIO */}
      <section aria-label="Campos da taxonomia" className="lg:min-h-0 lg:overflow-y-auto kp-scroll lg:pr-2 flex flex-col">
        <div className="flex items-end gap-2 pb-4">
          <div className="flex-1 min-w-0"><Field label="Cliente">
            <div className="relative">
              <select aria-label="Cliente" value={client.id} onChange={async e => { const id = e.target.value; await autosave.flush(); setSt(s => ({ ...s, cur: id })); }} className={inputCls + ' appearance-none pr-9 cursor-pointer'}>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
            </div>
          </Field></div>
          <button type="button" onClick={newClient} className={miniBtn + ' h-[42px]'}><Plus size={12} />Novo cliente</button>
        </div>
        <div role="group" aria-label="O que você está construindo" className="grid grid-cols-2 gap-1 p-1 rounded-xl border mb-1" style={cardStyle}>
          <button type="button" aria-pressed={camp} onClick={() => setSel({ mode: 'campanha' })} className={seg(camp)}>Campanha</button>
          <button type="button" aria-pressed={!camp} onClick={() => setSel({ mode: 'template' })} className={seg(!camp)}>Template</button>
        </div>

        <Section title="Classificação" dot="#4f46e5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {listSelect('centro')}
            {sel.centro === 'OUT' && (
              <div className="sm:col-span-2">
                <Field label="Sigla do centro “Outros” (até 4 letras)"><input className={inputCls} maxLength={4} placeholder="Ex.: mkt" value={sel.outro} onChange={e => setSel({ outro: e.target.value })} /></Field>
              </div>
            )}
            {listSelect('canal')}
            {listSelect('processo')}
            {listSelect('unidade')}
          </div>
        </Section>

        <Section title="Público" dot="#f59e0b">
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Modalidade</span>
            <div className="flex flex-wrap gap-2">
              {lists.modalidade.map(o => {
                const on = sel.modalidade.includes(o.c);
                return (
                  <label key={o.c + o.l} className={opt(on)}>
                    <input type="checkbox" className="accent-indigo-600" checked={on} onChange={e => { const set = new Set(sel.modalidade); if (e.target.checked) set.add(o.c); else set.delete(o.c); setSel({ modalidade: lists.modalidade.map(x => x.c).filter(c => set.has(c)) }); }} />
                    {o.l}<span className="font-mono text-[10px] text-[var(--text-muted)]">{o.c}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Tipo de contato</span>
            <div role="radiogroup" className="flex flex-wrap gap-2">
              {lists.tipo.map(o => (
                <label key={o.c + o.l} className={opt(sel.tipo === o.c)}>
                  <input type="radio" name="t-tipo" className="accent-indigo-600" checked={sel.tipo === o.c} onChange={() => setSel({ tipo: o.c })} />
                  {o.l}<span className="font-mono text-[10px] text-[var(--text-muted)]">{o.c}</span>
                </label>
              ))}
            </div>
          </div>
          <Field label="Número do contato"><input type="number" min={1} step={1} className={inputCls} placeholder="Ex.: 1, 2, 3" value={sel.num} onChange={e => setSel({ num: e.target.value })} /></Field>
        </Section>

        <Section title="Datas e oferta" dot="#3b82f6">
          {camp && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início da campanha"><input type="date" className={inputCls} value={sel.ini} onChange={e => setSel({ ini: e.target.value })} /></Field>
              <Field label="Fim da campanha"><input type="date" className={inputCls} value={sel.fim} onChange={e => setSel({ fim: e.target.value })} /></Field>
            </div>
          )}
          <Field label="Data do disparo"><input type="date" className={inputCls} value={sel.disp} onChange={e => setSel({ disp: e.target.value })} /></Field>
          <Field label="Oferta (se houver)"><input className={inputCls} placeholder="Ex.: desc50, bolsa30" value={sel.oferta} onChange={e => setSel({ oferta: e.target.value })} /></Field>
          {!camp && <Hint>No modo Template, o nome sai em caixa baixa e sem as datas de início e fim, igual ao gerador original.</Hint>}
        </Section>
        <div className="pt-4"><button type="button" onClick={clearFields} className={miniBtn}><Eraser size={12} />Limpar campos</button></div>
      </section>

      {/* RESULTADO, RECENTES E CADASTROS */}
      <section aria-label="Resultado" className="flex flex-col gap-4 [&>*]:shrink-0 lg:min-h-0 lg:overflow-y-auto kp-scroll lg:pr-1">
        <div className={card} style={cardStyle}>
          <h4 className="flex items-center gap-2 mb-3 font-display font-bold text-[var(--text-primary)]">Nome final <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] border border-[var(--border-primary)] rounded-md px-1.5 py-0.5">{camp ? 'Campanha' : 'Template'}</span></h4>
          <div aria-live="polite" aria-label="Nome final" className={`font-mono text-base sm:text-lg font-bold break-all rounded-xl px-4 py-3 ${name ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] italic text-sm font-sans font-normal'}`} style={{ background: 'var(--bg-primary)' }}>
            {name || 'Preencha os campos para gerar o nome'}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button type="button" disabled={!name} onClick={copyName} className={`${miniBtn} h-10 ${copied ? 'text-[var(--accent-strong-emerald)] border-emerald-500/40 bg-emerald-500/10' : ''}`}>{copied ? <Check size={12} /> : <Copy size={12} />}{copied ? 'Copiado' : 'Copiar nome'}</button>
            <button type="button" disabled={!name} onClick={useName} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"><Wand2 size={13} />Usar no template</button>
          </div>
          {parts.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3" aria-label="Partes do nome">
              {parts.map((p, i) => <span key={i} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-[var(--text-muted)] border border-[var(--border-primary)] rounded-lg px-2 py-1">{p.label}<b className="font-mono normal-case tracking-normal text-xs text-[var(--text-primary)]">{p.v}</b></span>)}
            </div>
          )}
        </div>

        <div className={card} style={cardStyle}>
          <h4 className="flex items-center gap-2 mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]"><span className="w-2 h-2 rounded-full bg-emerald-500" />Recentes</h4>
          {!st.recent.length ? <p className="text-sm text-[var(--text-muted)]">Os nomes que você copiar ou usar no template aparecem aqui.</p> : (
            <div className="flex flex-col gap-1.5">{st.recent.map(n => <RecentRow key={n} name={n} />)}</div>
          )}
        </div>

        <div className={card} style={cardStyle}>
          <h4 className="flex flex-wrap items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--text-secondary)]">
            <span className="w-2 h-2 rounded-full bg-pink-500" />Cadastros · <span className="normal-case tracking-normal text-sm font-bold text-[var(--text-primary)]">{client.name}</span>
            <SaveIndicator status={autosave.status} error={autosave.error} onRetry={() => void autosave.retry()} />
            <span className="ml-auto flex gap-1.5">
              <button type="button" onClick={rename} className={miniBtn}><Pencil size={12} />Renomear</button>
              <button type="button" onClick={remove} className={miniBtn + ' hover:!text-red-400'}><Trash2 size={12} />Excluir cliente</button>
            </span>
          </h4>
          <p className="text-xs text-[var(--text-muted)] mb-3">Cada cliente tem os próprios cadastros. Defina as opções de cada campo e a sigla que entra no nome. Fica salvo para toda a equipe.</p>
          <div role="tablist" aria-label="Campo do cadastro" className="flex flex-wrap gap-1 mb-3">
            {TAX_KEYS.map(k => (
              <button key={k} type="button" role="tab" aria-selected={regTab === k} onClick={() => setRegTab(k)} className={`h-8 px-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${regTab === k ? 'bg-[var(--bg-overlay-strong)] text-[var(--text-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{LABELS[k]}</button>
            ))}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_96px_36px] gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] mb-1.5"><span>Nome</span><span className="text-center">Sigla</span><span /></div>
          {!lists[regTab].length && <p className="text-sm text-[var(--text-muted)] py-2">Nenhuma opção cadastrada em {LABELS[regTab].toLowerCase()}.</p>}
          <div ref={rowsRef} className="flex flex-col gap-2">
            {lists[regTab].map((o, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_96px_36px] gap-2">
                <input aria-label="Nome da opção" placeholder="Ex.: Madureira" value={o.l} onChange={e => { const v = e.target.value; editLists(l => { l[regTab][i].l = v; }); }} className={inputCls} />
                <input aria-label="Sigla" placeholder="MAD" value={o.c} onChange={e => setSigla(i, e.target.value)} className={inputCls + ' font-mono text-center uppercase'} />
                <button type="button" aria-label="Remover opção" onClick={() => removeOption(i)} className={xBtn}><X size={14} /></button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => { editLists(l => { l[regTab].push({ l: '', c: '' }); }); setFocusNew(true); }} className="mt-2 w-full h-10 rounded-xl border border-dashed border-[var(--border-hover)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-indigo-400 hover:border-indigo-500/50 inline-flex items-center justify-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><Plus size={12} />Nova opção</button>
        </div>
      </section>
    </div>
  );
}

function RecentRow({ name }: { name: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="flex-1 min-w-0 truncate font-mono text-xs text-[var(--text-primary)] rounded-lg px-2.5 py-2" style={{ background: 'var(--bg-primary)' }} title={name}>{name}</code>
      <button type="button" aria-label={'Copiar ' + name} onClick={async () => { if (await copyText(name)) { setDone(true); setTimeout(() => setDone(false), 1500); } }} className={miniBtn + ' h-8'}>{done ? <Check size={12} /> : <Copy size={12} />}{done ? 'Copiado' : 'Copiar'}</button>
    </div>
  );
}
