import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { ImageUploadError, uploadImage } from "../data/imageUpload.ts";
import { errorText } from "../data/supa.ts";
import { esc, LINK_RE, linkMapOf, usedLinks, VAR_RE } from "../lib/emailHtml.ts";
import { TYPES } from "../lib/library.ts";
import { BTN_MAX, btnIssues, resolveFor, smsInfo } from "../lib/textMsg.ts";
import { useAsk } from "../ui/Dialogs.tsx";
import { MessageBubble } from "../ui/MessageBubble.tsx";
import { useToast } from "../ui/Toast.tsx";
import type { TextData, WppButton } from "../types.ts";
import type { EditorProps } from "./EmailEditor.tsx";
import { ConflictDialog, EditorHeader, RubeusLine } from "./EditorChrome.tsx";
import { CopyButton, DashedAdd, Field, Hint, inputCls, KeyValueRows, miniBtn, Section, Select, xBtn } from "./parts.tsx";
import { useTemplateEditor } from "./useTemplateEditor.ts";

// Editores de SMS e WhatsApp (só texto, sem HTML) — port do editor de mensagem do protótipo.
// WhatsApp segue a estrutura de template da Rubeus: cabeçalho (nenhum, mídia ou texto até
// 60), corpo, rodapé (até 60) e botões CTA (até 2, no máximo 1 de telefone) OU Resposta
// instantânea (até 3), nunca misturados; títulos com até 25 caracteres.

const LIMIT_HF = 60;
const LIMIT_BTN = 25;
const len = (s: string) => [...(s || '')].length;

function Counter({ n, max }: { n: number, max: number }) {
  return <span className={`text-xs ${n > max ? 'text-orange-500 font-semibold' : 'text-[var(--text-muted)]'}`}>{n}/{max} caracteres</span>;
}

function Radios<T extends string>({ name, value, onChange, options }: { name: string, value: T, onChange: (v: T) => void, options: [T, string][] }) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-2">
      {options.map(([v, l]) => (
        <label key={v} className={`flex items-center gap-2 px-3 h-9 rounded-xl border text-sm cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-indigo-500 ${value === v ? 'border-indigo-500 bg-indigo-500/10 text-[var(--text-primary)]' : 'border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--bg-overlay)]'}`}>
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} className="accent-indigo-600" />{l}
        </label>
      ))}
    </div>
  );
}

/** Texto com variáveis e links trocados pelos valores (destacados), como no bloco do protótipo. */
function Resolved({ raw, empty, d, pre }: { raw: string, empty: string, d: TextData, pre?: boolean }) {
  if (!raw) return <span className="text-sm italic text-[var(--text-muted)]">{empty}</span>;
  const m: Record<string, string> = {};
  (d.vars || []).forEach(v => { const k = String(v.k || '').trim(); if (k) m[k] = v.v || ''; });
  const lm = linkMapOf(d);
  const hl = (s: string) => '<span class="bg-[#fff1a8] text-[#111] rounded px-0.5">' + esc(s) + '</span>';
  const html = esc(raw).replace(VAR_RE, (x, k) => (k in m ? hl(m[k]) : x)).replace(LINK_RE, (x, k) => (lm[k.toLowerCase()] ? hl(lm[k.toLowerCase()]) : x));
  return <span className={`text-sm text-[var(--text-primary)] break-words min-w-0 ${pre ? 'whitespace-pre-wrap' : ''}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

function Row({ k, children, copy }: { k: string, children: ReactNode, copy?: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[84px_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-1 py-2 border-t" style={{ borderColor: 'var(--border-overlay)' }}>
      <span className="col-span-2 sm:col-span-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] sm:pt-1">{k}</span>
      {children}
      {copy}
    </div>
  );
}

export function TextEditor({ row, deleted, userId, names, upsertLocal, onToggleRubeus, onGone }: EditorProps) {
  const ask = useAsk();
  const toast = useToast();
  const ed = useTemplateEditor<TextData>(row, userId, upsertLocal);
  const T = ed.draft;
  const set = ed.update;
  const ty = row.type;
  const wpp = ty === 'whatsapp';
  const [mobilePane, setMobilePane] = useState<'form' | 'preview'>('form');
  const [focusBtn, setFocusBtn] = useState(false);
  const btnList = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (deleted && !ed.autosave.isDirty() && !ed.conflict) onGone();
  }, [deleted, ed.autosave, ed.conflict, onGone]);

  useEffect(() => {
    if (!focusBtn) return;
    const ins = btnList.current?.querySelectorAll<HTMLInputElement>('input[aria-label="Título do botão"]');
    ins?.[ins.length - 1]?.focus();
    setFocusBtn(false);
  }, [focusBtn]);

  const hd = T.header, ft = T.footer;
  const buttons = T.btnMode === 'none' ? [] : (T.buttons || []);
  const resolved = resolveFor(T, T.texto);
  const max = BTN_MAX[T.btnMode] || 0;

  async function changeBtnMode(mode: TextData['btnMode']) {
    const lose = (T.buttons || []).filter(b => b.text && (mode === 'reply' ? b.type !== 'reply' : mode === 'cta' ? b.type === 'reply' : false)).length;
    if (lose && !await ask({ title: 'Trocar o tipo de botão?', message: lose + (lose === 1 ? ' botão será removido' : ' botões serão removidos') + ', porque CTA e Resposta instantânea não podem ser misturados.', ok: 'Trocar', tone: 'warning' })) return;
    set(d => {
      d.btnMode = mode;
      if (mode === 'reply') d.buttons = d.buttons.filter(b => b.type === 'reply');
      if (mode === 'cta') d.buttons = d.buttons.filter(b => b.type !== 'reply');
      if (mode !== 'none' && !d.buttons.length) d.buttons.push({ type: mode === 'reply' ? 'reply' : 'url', text: '', value: mode === 'reply' ? '' : '[link]' });
    });
  }

  function addButton() {
    if ((T.buttons || []).length >= max) { toast('Limite de ' + max + ' botões atingido'); return; }
    set(d => { d.buttons.push({ type: d.btnMode === 'reply' ? 'reply' : 'url', text: '', value: '' }); });
    setFocusBtn(true);
  }

  async function removeButton(i: number, b: WppButton) {
    if (!await ask({ title: 'Remover botão?', message: '“' + (b.text || 'Botão sem título') + '” será removido.', ok: 'Remover', tone: 'danger' })) return;
    set(d => { d.buttons.splice(i, 1); });
  }

  async function saveAsCopy() {
    try {
      const r = await ed.saveMineAsCopy();
      toast('Sua versão foi salva como “' + r.data.nome + '”');
      if (ed.conflict?.current) ed.loadTheirs(); else { ed.dismissConflict(); onGone(); }
    } catch (e) { toast('Não foi possível salvar a cópia: ' + errorText(e)); }
  }

  // Avisos sob a mensagem (contador, botões, links), como no protótipo.
  const issues = wpp ? btnIssues(T) : [];
  const lm = linkMapOf(T);
  const missLinks = [...usedLinks(T.texto)].filter(k => !lm[k]);
  const sms = smsInfo(resolved);
  const seg = (on: boolean) => `h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${on ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      <EditorHeader row={ed.base} nome={T.nome} status={ed.autosave.status} error={ed.autosave.error} onRetry={() => void ed.autosave.retry()} />

      <div role="group" aria-label="Mostrar" className="lg:hidden grid grid-cols-2 gap-1 p-1 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
        <button type="button" aria-pressed={mobilePane === 'form'} onClick={() => setMobilePane('form')} className={seg(mobilePane === 'form')}>Editar</button>
        <button type="button" aria-pressed={mobilePane === 'preview'} onClick={() => setMobilePane('preview')} className={seg(mobilePane === 'preview')}>Prévia</button>
      </div>

      <div className="flex-1 min-h-0 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-6">
        {/* FORMULÁRIO */}
        <section aria-label="Conteúdo da mensagem" className={`${mobilePane === 'form' ? 'block' : 'hidden'} lg:block lg:min-h-0 lg:overflow-y-auto kp-scroll lg:pr-2`}>
          <Section title="Identificação" dot="#71717a">
            <Field label="Nome do template">
              <input spellCheck={false}
                className={inputCls} value={T.nome} placeholder="Ex.: cap_wpp_grd_en_ead_prm_c1"
                onChange={e => {
                  const el = e.target; let v = el.value;
                  if (wpp && v !== v.toLowerCase()) { const p = el.selectionStart; v = v.toLowerCase(); requestAnimationFrame(() => { try { el.setSelectionRange(p, p); } catch {} }); }
                  set(d => { d.nome = v; });
                }}
              />
            </Field>
            <Field label="Assunto / título"><input spellCheck={true} lang="pt-BR" className={inputCls} value={T.assunto} placeholder="Do que se trata a mensagem" onChange={e => { const v = e.target.value; set(d => { d.assunto = v; }); }} /></Field>
          </Section>

          {wpp && (
            <Section title="Cabeçalho" dot="#a855f7" aside="opcional">
              <Radios name="tx-hd" value={hd.type} onChange={v => set(d => { d.header.type = v; })} options={[['none', 'Sem cabeçalho'], ['media', 'Mídia'], ['text', 'Texto']]} />
              {hd.type === 'media' && (
                <>
                  <Field label="Tipo de mídia"><Select value={hd.mtype || 'image'} onChange={v => set(d => { d.header.mtype = v as TextData['header']['mtype']; d.header.src = ''; d.header.upload = ''; })} options={[['image', 'Imagem'], ['video', 'Vídeo'], ['document', 'Documento (PDF)']]} /></Field>
                  <HeaderMedia header={hd} edit={fn => set(d => fn(d.header))} />
                  <Hint>A imagem aqui serve de referência visual. Na Rubeus, envie o mesmo arquivo na opção <strong>Mídia</strong> do cabeçalho. Imagem: JPG ou PNG até 5 MB.</Hint>
                </>
              )}
              {hd.type === 'text' && (
                <Field label="Texto do cabeçalho" hint={<Counter n={len(hd.text)} max={LIMIT_HF} />}>
                  <input spellCheck={true} lang="pt-BR" className={inputCls} value={hd.text} placeholder="Ex.: Sua vaga está reservada!" onChange={e => { const v = e.target.value; set(d => { d.header.text = v; }); }} />
                </Field>
              )}
            </Section>
          )}

          <Section title="Mensagem" dot="#10b981">
            <Field label="Texto"><textarea spellCheck={true} lang="pt-BR" className={inputCls + ' min-h-[300px] resize-y leading-relaxed'} value={T.texto} onChange={e => { const v = e.target.value; set(d => { d.texto = v; }); }} /></Field>
            <Hint>
              {wpp
                ? <>Formatação do WhatsApp: <code>*negrito*</code>, <code>_itálico_</code>, <code>~riscado~</code> e <code>```monoespaçado```</code>. Variáveis como <code>{'{1}'}</code>.</>
                : <>SMS não tem formatação. Evite acentos e emojis para caber mais texto em cada mensagem. Variáveis como <code>{'{1}'}</code>.</>}
            </Hint>
            <p className="text-xs leading-relaxed text-[var(--text-secondary)]" aria-live="polite" aria-label="Contagem">
              {ty === 'sms'
                ? <><strong>{sms.len}</strong> caracteres · <strong>{sms.seg}</strong> SMS{sms.gsm ? ' (até 160 por SMS)' : ' · acentos ou emojis reduzem o limite para 70 por SMS'}. As variáveis contam com o tamanho do texto delas.</>
                : <><strong>{len(resolved)}</strong> caracteres{len(resolved) > 1024 ? ' · templates do WhatsApp aceitam até 1.024 caracteres no corpo' : ''}.</>}
              {issues.length > 0 && <span className="text-orange-500 font-semibold"> Botões: {issues.join('; ')}.</span>}
              {missLinks.length > 0 && <span className="text-orange-500 font-semibold"> Link sem endereço: {missLinks.map(k => '[' + k + ']').join(', ')}.</span>}
            </p>
          </Section>

          {wpp && (
            <Section title="Rodapé" dot="#f59e0b" aside="opcional">
              <Radios name="tx-ft" value={ft.type} onChange={v => set(d => { d.footer.type = v; })} options={[['none', 'Sem rodapé'], ['text', 'Texto']]} />
              {ft.type === 'text' && (
                <Field label="Texto do rodapé" hint={<Counter n={len(ft.text)} max={LIMIT_HF} />}>
                  <input spellCheck={true} lang="pt-BR" className={inputCls} value={ft.text} placeholder="Ex.: Celso Lisboa · Centro Universitário" onChange={e => { const v = e.target.value; set(d => { d.footer.text = v; }); }} />
                </Field>
              )}
            </Section>
          )}

          {wpp && (
            <Section title="Botões" dot="#25d366" aside="opcional">
              <Radios name="tx-bm" value={T.btnMode} onChange={changeBtnMode} options={[['none', 'Sem botões'], ['cta', 'CTA'], ['reply', 'Resposta instantânea']]} />
              {T.btnMode === 'cta' && <Hint><strong>CTA</strong>: até 2 botões, cada um de link (pode usar <code>[link]</code>) ou telefone (no máximo 1 de telefone). Título com até 25 caracteres.</Hint>}
              {T.btnMode === 'reply' && <Hint><strong>Resposta instantânea</strong>: até 3 botões; o título é enviado como resposta. Até 25 caracteres cada.</Hint>}
              {T.btnMode !== 'none' && (
                <div ref={btnList} className="flex flex-col gap-2.5">
                  {(T.buttons || []).map((b, i) => {
                    const reply = T.btnMode === 'reply';
                    const type = reply ? 'reply' : b.type === 'reply' ? 'url' : b.type;
                    return (
                      <div key={i} className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)_auto] gap-2 p-2.5 rounded-xl border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}>
                        <select aria-label="Tipo de botão" disabled={reply} value={type} onChange={e => { const v = e.target.value as WppButton['type']; set(d => { d.buttons[i].type = v; }); }} className={inputCls + ' cursor-pointer disabled:opacity-70'}>
                          {(reply ? [['reply', 'Resposta']] : [['url', 'Link'], ['phone', 'Telefone']]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <input spellCheck={true} lang="pt-BR" aria-label="Título do botão" placeholder="Título do botão" value={b.text || ''} onChange={e => { const v = e.target.value; set(d => { d.buttons[i].text = v; }); }} className={inputCls} />
                        <button type="button" aria-label="Remover botão" onClick={() => removeButton(i, b)} className={xBtn}><X size={14} /></button>
                        {type !== 'reply' && (
                          <input spellCheck={false} aria-label="Destino do botão" placeholder={type === 'phone' ? 'Telefone com DDI e DDD, ex.: +55 21 99999-9999' : 'Endereço ou [link]'} value={b.value || ''} onChange={e => { const v = e.target.value.trim(); set(d => { d.buttons[i].value = v; }); }} className={inputCls + ' col-span-2'} />
                        )}
                        <span className={type !== 'reply' ? 'self-center' : 'col-span-3'}><Counter n={len(b.text)} max={LIMIT_BTN} /></span>
                      </div>
                    );
                  })}
                  <DashedAdd onClick={addButton} hidden={(T.buttons || []).length >= max}>Novo botão</DashedAdd>
                </div>
              )}
            </Section>
          )}

          <Section title="Links" dot="#3b82f6">
            <Hint>Escreva <code>[link]</code> na mensagem (ou <code>[link2]</code>, <code>[link3]</code>…) e defina aqui o endereço. Ao copiar, ele é trocado pelo link.</Hint>
            <KeyValueRows kind="links" items={T.links || []} onChange={next => set(d => { d.links = next; })} />
          </Section>

          <Section title="Variáveis" dot="#ec4899">
            <Hint>Escreva <code>{'{1}'}</code> no texto e declare aqui o que ele vira ao copiar.</Hint>
            <KeyValueRows kind="vars" items={T.vars || []} onChange={next => set(d => { d.vars = next; })} />
          </Section>
        </section>

        {/* DADOS + CELULAR */}
        <section aria-label="Prévia da mensagem" className={`${mobilePane === 'preview' ? 'flex' : 'hidden'} lg:flex flex-col gap-5 [&>*]:shrink-0 lg:min-h-0 lg:overflow-y-auto kp-scroll lg:pr-1 pt-4 lg:pt-0`}>
          <div className="rounded-2xl border p-4 sm:p-5" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }} aria-label="Dados do template">
            <h4 className="flex items-center gap-2 mb-3 font-display font-bold text-[var(--text-primary)]">Dados do template <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] border border-[var(--border-primary)] rounded-md px-1.5 py-0.5">{TYPES[ty]}</span></h4>
            <div className="mb-3"><RubeusLine row={ed.base} onToggle={() => onToggleRubeus(ed.base)} /></div>
            <Row k="Nome" copy={<CopyButton value={T.nome} ariaLabel="Copiar nome" />}><Resolved raw={T.nome} empty="Sem nome" d={T} /></Row>
            <Row k="Assunto" copy={<CopyButton value={resolveFor(T, T.assunto)} ariaLabel="Copiar assunto" />}><Resolved raw={T.assunto} empty="Preencha o assunto" d={T} /></Row>
            {wpp && hd.type !== 'none' && (
              <Row k="Cabeçalho" copy={<CopyButton value={hd.type === 'text' ? resolveFor(T, hd.text) : ''} ariaLabel="Copiar cabeçalho" />}>
                <span className="text-sm text-[var(--text-primary)] break-words min-w-0">
                  {hd.type === 'text' ? (hd.text || '(vazio)') : ({ image: 'Imagem', video: 'Vídeo', document: 'Documento' }[hd.mtype]) + (hd.upload ? ': ' + hd.upload : hd.src ? ': ' + hd.src : ' (envie o arquivo na Rubeus)')}
                </span>
              </Row>
            )}
            <Row k="Mensagem" copy={<CopyButton value={resolved} ariaLabel="Copiar mensagem" />}><Resolved raw={T.texto} empty="Escreva a mensagem" d={T} pre /></Row>
            {wpp && ft.type !== 'none' && (
              <Row k="Rodapé" copy={<CopyButton value={ft.text} ariaLabel="Copiar rodapé" />}><span className="text-sm text-[var(--text-primary)] break-words min-w-0">{ft.text || '(vazio)'}</span></Row>
            )}
            {wpp && (
              <Row k="Botões">
                {!buttons.length ? <span className="text-sm italic text-[var(--text-muted)]">Nenhum botão</span> : (
                  <div className="flex flex-col gap-2 min-w-0 col-span-2 sm:col-span-2">
                    {buttons.map((b, i) => {
                      const head = 'Botão ' + (i + 1) + ' · ' + (T.btnMode === 'reply' ? 'Resposta instantânea' : b.type === 'phone' ? 'CTA telefone' : 'CTA link');
                      const val = b.type === 'reply' ? '' : resolveFor(T, b.value);
                      return (
                        <div key={i} className="rounded-xl border p-2.5 flex flex-col gap-1.5" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{head}</span>
                          <BtnCopyLine label="Texto" value={b.text || ''} aria={`Copiar texto do botão ${i + 1}`} />
                          {T.btnMode !== 'reply' && <BtnCopyLine label={b.type === 'phone' ? 'Telefone' : 'URL'} value={val} aria={`Copiar ${b.type === 'phone' ? 'telefone' : 'URL'} do botão ${i + 1}`} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Row>
            )}
          </div>

          <Phone type={ty}><MessageBubble data={T} type={ty} /></Phone>
        </section>
      </div>

      {ed.conflict && (
        <ConflictDialog current={ed.conflict.current} names={names} onLoadTheirs={ed.loadTheirs} onKeepMine={ed.keepMine} onSaveCopy={saveAsCopy} onDiscard={() => { ed.dismissConflict(); onGone(); }} />
      )}
    </div>
  );
}

function BtnCopyLine({ label, value, aria }: { label: string, value: string, aria: string }) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{label}</span>
      <span className={`text-sm truncate ${value ? 'text-[var(--text-primary)]' : 'italic text-[var(--text-muted)]'}`} title={value}>{value || 'vazio'}</span>
      <CopyButton value={value} ariaLabel={aria} />
    </div>
  );
}

/** Moldura de celular da prévia (cores fixas, como a tela do aparelho). */
function Phone({ type, children }: { type: string, children: ReactNode }) {
  const sms = type === 'sms';
  return (
    <div className="w-[360px] max-w-full mx-auto rounded-[28px] border-[8px] border-[#18181b] overflow-hidden shadow-xl" style={{ background: sms ? '#fff' : '#efeae2' }}>
      <div className={sms ? 'flex flex-col items-center justify-center gap-1 px-3.5 py-3 text-center text-[#111] border-b border-[#e4e4e7]' : 'flex items-center gap-2.5 px-3.5 py-3 text-white'} style={{ background: sms ? '#f2f2f7' : '#075e54' }}>
        <span className="w-8 h-8 rounded-full grid place-items-center font-bold text-sm text-white shrink-0" style={{ background: sms ? '#a1a1aa' : '#128c7e' }}>C</span>
        <span className="leading-tight"><b className="text-sm block">Celso Lisboa</b><small className="text-[11px] opacity-75">{sms ? 'Mensagem de texto' : 'online'}</small></span>
      </div>
      <div className="min-h-[380px] px-3.5 py-[18px]">{children}</div>
    </div>
  );
}

/** Mídia do cabeçalho do WhatsApp: imagem (link ou envio ao storage) ou nome do PDF. */
function HeaderMedia({ header, edit }: { header: TextData['header'], edit: (fn: (h: TextData['header']) => void) => void }) {
  const ask = useAsk();
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  if (header.mtype !== 'image' && header.mtype !== 'document') return <Hint>Vídeo não aparece na prévia; envie o arquivo direto na Rubeus.</Hint>;

  async function onFile(f: File | undefined) {
    if (!f) return;
    if (header.mtype === 'document') { edit(h => { h.src = 'file'; h.upload = f.name; }); return; }
    setBusy(true);
    try { const url = await uploadImage(f); edit(h => { h.src = url; h.upload = f.name; }); }
    catch (e) { toast(e instanceof ImageUploadError ? e.message : 'Não foi possível enviar a imagem: ' + errorText(e)); }
    finally { setBusy(false); if (file.current) file.current.value = ''; }
  }

  if (header.upload && header.src) {
    return (
      <div className="flex items-center gap-2 p-2 rounded-xl border" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-primary)' }}>
        {header.mtype === 'image' ? <img src={header.src} alt="" className="w-14 h-10 object-cover rounded-md bg-[var(--bg-tertiary)]" /> : <span aria-hidden="true">📄</span>}
        <span className="text-xs font-mono text-[var(--text-secondary)] truncate flex-1">{header.upload}</span>
        <button type="button" aria-label="Remover mídia" className={xBtn} onClick={async () => {
          if (!await ask({ title: 'Remover mídia?', message: 'A mídia do cabeçalho será retirada.', ok: 'Remover', tone: 'danger' })) return;
          edit(h => { h.src = ''; h.upload = ''; });
        }}><X size={14} /></button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <input spellCheck={false} type="url" aria-label={header.mtype === 'image' ? 'URL da imagem' : 'Nome ou link do PDF'} placeholder={header.mtype === 'image' ? 'https://… link direto da imagem' : 'Nome ou link do PDF'} value={header.src || ''} onChange={e => { const v = e.target.value.trim(); edit(h => { h.src = v; h.upload = ''; }); }} className={inputCls + ' flex-1 min-w-[180px]'} />
      <button type="button" disabled={busy} onClick={() => file.current?.click()} className={miniBtn}>{busy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}{busy ? 'Enviando…' : 'Enviar arquivo'}</button>
      <input ref={file} type="file" hidden accept={header.mtype === 'image' ? 'image/png,image/jpeg' : 'application/pdf'} onChange={e => onFile(e.target.files?.[0])} />
    </div>
  );
}
