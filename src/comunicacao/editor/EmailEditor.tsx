import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Copy, RotateCcw } from "lucide-react";
import { clone, DEFAULT } from "../defaults.ts";
import { errorText } from "../data/supa.ts";
import { emailWarnings, sizeLabel } from "../lib/emailChecks.ts";
import { esc, generateEmailHtml, resolve, VAR_RE, varMap } from "../lib/emailHtml.ts";
import { useAsk } from "../ui/Dialogs.tsx";
import { useToast } from "../ui/Toast.tsx";
import type { EmailData, TemplateRow } from "../types.ts";
import { ConflictDialog, EditorHeader, RubeusLine } from "./EditorChrome.tsx";
import { EmailPreview } from "./EmailPreview.tsx";
import { ImageField } from "./ImageField.tsx";
import { Check2, ColorField, copyText, CopyButton, Field, Hint, inputCls, KeyValueRows, Section, Select } from "./parts.tsx";
import { SocialList } from "./SocialList.tsx";
import { useTemplateEditor } from "./useTemplateEditor.ts";

// Editor de e-mail: formulário à esquerda; dados do envio, avisos e prévia à direita.
// Textos, opções e ordem dos campos seguem o protótipo.

export interface EditorProps {
  row: TemplateRow;
  deleted: boolean;
  userId: string;
  names: Record<string, string>;
  upsertLocal: (r: TemplateRow) => void;
  onToggleRubeus: (r: TemplateRow) => void;
  onGone: () => void;
}

/** Valor do bloco "Dados do envio" com as variáveis trocadas e destacadas. */
function BlockValue({ raw, empty, vars }: { raw: string, empty: string, vars: Record<string, string> }) {
  if (!raw) return <span className="text-sm italic text-[var(--text-muted)]">{empty}</span>;
  const html = esc(raw).replace(VAR_RE, (m, k) => (k in vars ? '<span class="bg-[#fff1a8] text-[#111] rounded px-0.5">' + esc(vars[k]) + '</span>' : m));
  return <span className="text-sm text-[var(--text-primary)] break-words min-w-0" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function EmailEditor({ row, deleted, userId, names, upsertLocal, onToggleRubeus, onGone }: EditorProps) {
  const ask = useAsk();
  const toast = useToast();
  const ed = useTemplateEditor<EmailData>(row, userId, upsertLocal);
  const S = ed.draft;
  const set = ed.update;
  const [width, setWidth] = useState(600);
  const [hl, setHl] = useState(true);
  const [mobilePane, setMobilePane] = useState<'form' | 'preview'>('form');
  const codeRef = useRef<HTMLDetailsElement>(null);
  const codeArea = useRef<HTMLTextAreaElement>(null);


  // Excluído por outra pessoa: sai do editor se não houver nada pendente; senão o
  // salvamento cai no conflito (com a opção de salvar como novo template).
  useEffect(() => {
    if (deleted && !ed.autosave.isDirty() && !ed.conflict) onGone();
  }, [deleted, ed.autosave, ed.conflict, onGone]);

  const code = useMemo(() => generateEmailHtml(S), [S]);
  // A prévia acompanha a digitação com um pequeno atraso (como o render do protótipo).
  const [previewSrc, setPreviewSrc] = useState(() => generateEmailHtml(S, { preview: true, highlight: hl }));
  useEffect(() => {
    const t = setTimeout(() => setPreviewSrc(generateEmailHtml(S, { preview: true, highlight: hl })), 160);
    return () => clearTimeout(t);
  }, [S, hl]);
  const warns = useMemo(() => emailWarnings(S, code), [S, code]);
  const vars = varMap(S);

  async function copyHtml() {
    if (await copyText(code)) { toast('HTML copiado'); return; }
    if (codeRef.current) codeRef.current.open = true;
    setTimeout(() => { codeArea.current?.focus(); codeArea.current?.select(); }, 50);
    toast('Código selecionado abaixo. Use Ctrl+C (ou ⌘+C) para copiar.');
  }

  async function restoreExample() {
    if (!await ask({ title: 'Restaurar exemplo?', message: 'O conteúdo atual do e-mail será substituído pelo exemplo.', ok: 'Restaurar', tone: 'warning' })) return;
    set(d => { Object.assign(d, clone(DEFAULT)); });
  }

  async function saveAsCopy() {
    try {
      const r = await ed.saveMineAsCopy();
      toast('Sua versão foi salva como “' + r.data.nome + '”');
      if (ed.conflict?.current) ed.loadTheirs(); else { ed.dismissConflict(); onGone(); }
    } catch (e) { toast('Não foi possível salvar a cópia: ' + errorText(e)); }
  }

  const seg = (on: boolean) => `h-8 px-3 rounded-lg text-[10px] font-bold uppercase tracking-widest outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${on ? 'bg-indigo-600 text-white' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`;
  const panel = 'rounded-2xl border p-4 sm:p-5';

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      <EditorHeader
        row={ed.base} nome={S.nome} status={ed.autosave.status} error={ed.autosave.error} onRetry={() => void ed.autosave.retry()}
        actions={<>
          <button type="button" onClick={restoreExample} className="h-10 px-3.5 rounded-xl border border-[var(--border-primary)] text-[10px] font-bold uppercase tracking-widest text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)] inline-flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"><RotateCcw size={13} />Restaurar exemplo</button>
          <button type="button" onClick={copyHtml} className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest inline-flex items-center gap-2 shadow-[0_0_15px_rgba(79,70,229,0.3)] outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"><Copy size={13} />Copiar HTML</button>
        </>}
      />

      <div role="group" aria-label="Mostrar" className="lg:hidden grid grid-cols-2 gap-1 p-1 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
        <button type="button" aria-pressed={mobilePane === 'form'} onClick={() => setMobilePane('form')} className={seg(mobilePane === 'form')}>Editar</button>
        <button type="button" aria-pressed={mobilePane === 'preview'} onClick={() => setMobilePane('preview')} className={seg(mobilePane === 'preview')}>Prévia</button>
      </div>

      <div className="flex-1 min-h-0 lg:grid lg:grid-cols-[minmax(0,440px)_minmax(0,1fr)] lg:gap-6">
        {/* FORMULÁRIO */}
        <section aria-label="Conteúdo do e-mail" className={`${mobilePane === 'form' ? 'block' : 'hidden'} lg:block lg:min-h-0 lg:overflow-y-auto kp-scroll lg:pr-2`}>
          <Section title="Identificação" dot="#71717a">
            <Field label="Nome do template"><input className={inputCls} value={S.nome} placeholder="Ex.: CAP_EML_GRD_EN_EAD_REP_C2" onChange={e => { const v = e.target.value; set(d => { d.nome = v; }); }} /></Field>
            <Field label="Assunto"><input className={inputCls} value={S.assunto} placeholder="O que aparece como título na caixa de entrada" onChange={e => { const v = e.target.value; set(d => { d.assunto = v; }); }} /></Field>
            <Field label="Preheader"><input className={inputCls} value={S.preheader} placeholder="Frase curta exibida ao lado do assunto" onChange={e => { const v = e.target.value; set(d => { d.preheader = v; }); }} /></Field>
            <Hint>O preheader também entra escondido no topo do HTML, para os clientes de e-mail exibirem.</Hint>
          </Section>

          <Section title="Imagem do topo" dot="#4f46e5">
            <ImageField img={S.banner} which="banner" edit={fn => set(d => fn(d.banner))} />
            <Field label="Texto alternativo"><input className={inputCls} value={S.banner.alt} placeholder="Aparece quando a imagem não carrega" onChange={e => { const v = e.target.value; set(d => { d.banner.alt = v; }); }} /></Field>
            <Field label="Link ao clicar (opcional)"><input type="url" className={inputCls} value={S.banner.link} placeholder="Ex.: https://www.rubeus.com.br/" onChange={e => { const v = e.target.value; set(d => { d.banner.link = v; }); }} /></Field>
          </Section>

          <Section title="Texto" dot="#f59e0b">
            <Field label="Conteúdo"><textarea spellCheck className={inputCls + ' min-h-[260px] resize-y leading-relaxed'} value={S.texto} onChange={e => { const v = e.target.value; set(d => { d.texto = v; }); }} /></Field>
            <Hint>Linha em branco cria um novo parágrafo. Use <code>**negrito**</code>, <code>[texto](https://link)</code> e variáveis como <code>{'{1}'}</code> e links como <code>[link]</code>. Para colocar texto <strong>abaixo do botão</strong>, escreva <code>[botão]</code> sozinho numa linha, no ponto onde ele deve aparecer.</Hint>
            <Field label="Alinhamento"><Select value={S.textAlign} onChange={v => set(d => { d.textAlign = v; })} options={[['left', 'À esquerda'], ['justify', 'Justificado'], ['center', 'Centralizado']]} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor do texto"><ColorField value={S.textColor} onChange={v => set(d => { d.textColor = v; })} /></Field>
              <Field label="Tamanho"><Select value={S.fontSize} onChange={v => set(d => { d.fontSize = v; })} options={[['14', '14 px'], ['15', '15 px'], ['16', '16 px'], ['17', '17 px']]} /></Field>
            </div>
            <Field label="Fonte" hint="Gmail, Apple Mail e o celular mostram a Poppins; o Outlook usa Arial no lugar."><Select value={S.font} onChange={v => set(d => { d.font = v; })} options={[['poppins', 'Poppins (padrão do Marka)'], ['arial', 'Arial']]} /></Field>
          </Section>

          <Section title="Botão" dot="#3b82f6">
            <Field label="Título do botão"><input className={inputCls} value={S.btn.text} onChange={e => { const v = e.target.value; set(d => { d.btn.text = v; }); }} /></Field>
            <Field label="Link"><input type="url" className={inputCls} value={S.btn.link} placeholder="Ex.: https://www.rubeus.com.br/" onChange={e => { const v = e.target.value; set(d => { d.btn.link = v; }); }} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cor do botão"><ColorField value={S.btn.bg} onChange={v => set(d => { d.btn.bg = v; })} /></Field>
              <Field label="Cor do título"><ColorField value={S.btn.color} onChange={v => set(d => { d.btn.color = v; })} /></Field>
            </div>
            <Check2 checked={!!S.btn.upper} onChange={v => set(d => { d.btn.upper = v; })}>Título em caixa alta</Check2>
          </Section>

          <Section title="Rodapé" dot="#10b981">
            <ImageField img={S.footer} which="footer" edit={fn => set(d => fn(d.footer))} />
            <Field label="Texto alternativo"><input className={inputCls} value={S.footer.alt} onChange={e => { const v = e.target.value; set(d => { d.footer.alt = v; }); }} /></Field>
            <Field label="Link ao clicar (opcional)"><input type="url" className={inputCls} value={S.footer.link} placeholder="Ex.: https://www.rubeus.com.br/" onChange={e => { const v = e.target.value; set(d => { d.footer.link = v; }); }} /></Field>
          </Section>

          <Section title="Redes sociais e contato" dot="#0ea5e9" open={false}>
            <Check2 checked={!!S.social.on} onChange={v => set(d => { d.social.on = v; })}>Mostrar bloco de redes e contato no fim do e-mail</Check2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fundo"><ColorField value={S.social.bg} onChange={v => set(d => { d.social.bg = v; })} /></Field>
              <Field label="Faixa no topo"><ColorField value={S.social.accent} onChange={v => set(d => { d.social.accent = v; })} /></Field>
              <Field label="Cor do texto"><ColorField value={S.social.color} onChange={v => set(d => { d.social.color = v; })} /></Field>
              <Field label="Tamanho dos ícones"><Select value={S.social.size} onChange={v => set(d => { d.social.size = v; })} options={[['24', '24 px'], ['30', '30 px'], ['36', '36 px']]} /></Field>
              <Field label="Posição do bloco"><Select value={S.social.pos} onChange={v => set(d => { d.social.pos = v; })} options={[['below', 'Abaixo da imagem do rodapé'], ['above', 'Acima da imagem do rodapé']]} /></Field>
              <Field label="Estilo dos ícones"><Select value={S.social.iconStyle} onChange={v => set(d => { d.social.iconStyle = v; })} options={[['light', 'Brancos'], ['color', 'Coloridos'], ['dark', 'Escuros'], ['outline-light', 'Contorno branco'], ['outline-dark', 'Contorno escuro']]} /></Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">Redes</span>
              <SocialList social={S.social} edit={fn => set(d => fn(d.social))} />
            </div>
            <Hint>Instagram, Facebook, YouTube, LinkedIn, X e Pinterest já vêm com ícones fixos, hospedados no servidor público de ícones de e-mail do Mailchimp, e mudam conforme o estilo escolhido. TikTok, WhatsApp e Site não têm ícone padrão: cole o link de um ícone ou eles aparecem como texto.</Hint>
            <Field label="Título"><input className={inputCls} value={S.social.title} placeholder="Ex.: Entre em contato conosco" onChange={e => { const v = e.target.value; set(d => { d.social.title = v; }); }} /></Field>
            <Field label="Contatos (uma linha por item)"><textarea className={inputCls + ' min-h-[90px] resize-y'} value={S.social.contato} placeholder={'[Câmpus Taguatinga](https://goo.gl/maps/...) | [Câmpus Ceilândia](https://goo.gl/maps/...)\n[Telefone: (61) 3356-9075](https://wa.me/556133569075)'} onChange={e => { const v = e.target.value; set(d => { d.social.contato = v; }); }} /></Field>
            <Check2 checked={!!S.social.unsub} onChange={v => set(d => { d.social.unsub = v; })}>Incluir linha de descadastro</Check2>
            <Field label="Texto do descadastro"><input className={inputCls} value={S.social.unsubText} onChange={e => { const v = e.target.value; set(d => { d.social.unsubText = v; }); }} /></Field>
            <Hint>A Rubeus já adiciona o próprio rodapé com descadastro. Use esta linha só se o cliente quiser o descadastro dentro do bloco, como no modelo UCB.</Hint>
          </Section>

          <Section title="Links" dot="#3b82f6">
            <Hint>Escreva <code>[link]</code> no texto (ou <code>[link2]</code>, <code>[link3]</code>…) e defina aqui o endereço. No e-mail ele vira um link clicável; para mostrar um texto no lugar do endereço, use <code>[clique aqui](link)</code>. Também funciona nos campos de link do botão e das imagens.</Hint>
            <KeyValueRows kind="links" items={S.links || []} onChange={next => set(d => { d.links = next; })} />
          </Section>

          <Section title="Variáveis" dot="#ec4899">
            <Hint>Escreva <code>{'{1}'}</code> no texto, no assunto, no botão ou nos links, e declare aqui o que ele vira no HTML final.</Hint>
            <KeyValueRows kind="vars" items={S.vars || []} onChange={next => set(d => { d.vars = next; })} />
          </Section>

          <Section title="Topo e fundo" dot="#a1a1aa" open={false}>
            <Check2 checked={!!S.webview.on} onChange={v => set(d => { d.webview.on = v; })}>Mostrar “Visualizar como página web”</Check2>
            <Field label="Texto do link"><input className={inputCls} value={S.webview.text} onChange={e => { const v = e.target.value; set(d => { d.webview.text = v; }); }} /></Field>
            <Field label="Link da versão web"><input className={inputCls} value={S.webview.url} placeholder="URL ou variável, ex.: {2}" onChange={e => { const v = e.target.value; set(d => { d.webview.url = v; }); }} /></Field>
            <Field label="Cor de fundo atrás do e-mail"><ColorField value={S.bg} onChange={v => set(d => { d.bg = v; })} /></Field>
          </Section>
        </section>

        {/* DADOS DO ENVIO + PRÉVIA */}
        <section aria-label="Prévia" className={`${mobilePane === 'preview' ? 'flex' : 'hidden'} lg:flex flex-col gap-4 [&>*]:shrink-0 lg:min-h-0 lg:overflow-y-auto kp-scroll lg:pr-1 pt-4 lg:pt-0`}>
          <div className={panel} style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }} aria-label="Dados do envio">
            <h4 className="flex items-center gap-2 mb-3 font-display font-bold text-[var(--text-primary)]">Dados do envio <span className="text-[9px] font-bold uppercase tracking-widest text-[var(--text-muted)] border border-[var(--border-primary)] rounded-md px-1.5 py-0.5">Copie para a plataforma</span></h4>
            <div className="mb-3"><RubeusLine row={ed.base} onToggle={() => onToggleRubeus(ed.base)} /></div>
            {([['Nome', S.nome, 'Sem nome', S.nome], ['Assunto', S.assunto, 'Preencha o assunto em Identificação', resolve(S.assunto, S)], ['Preheader', S.preheader, 'Preencha o preheader em Identificação', resolve(S.preheader, S)]] as const).map(([k, raw, empty, copyVal]) => (
              <div key={k} className="grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-2 border-t" style={{ borderColor: 'var(--border-overlay)' }}>
                <span className="col-span-2 sm:col-span-1 text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]">{k}</span>
                <BlockValue raw={raw} empty={empty} vars={k === 'Nome' ? {} : vars} />
                <CopyButton value={copyVal} ariaLabel={'Copiar ' + k.toLowerCase()} />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Largura da prévia" className="flex gap-0.5 p-1 rounded-xl border" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
              <button type="button" aria-pressed={width === 600} onClick={() => setWidth(600)} className={seg(width === 600)}>Desktop</button>
              <button type="button" aria-pressed={width === 375} onClick={() => setWidth(375)} className={seg(width === 375)}>Celular</button>
            </div>
            <Check2 checked={hl} onChange={setHl}>Destacar variáveis</Check2>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)]" aria-label="Tamanho do HTML">{sizeLabel(code)}</span>
          </div>

          {warns.length > 0 && (
            <ul className="flex flex-col gap-2" aria-label="Avisos">
              {warns.map(w => <li key={w} className="flex gap-2 text-xs leading-relaxed rounded-xl px-3 py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400"><AlertTriangle size={14} className="shrink-0 mt-0.5" />{w}</li>)}
            </ul>
          )}

          <div className="rounded-2xl p-3 sm:p-5" style={{ background: S.bg }}>
            <EmailPreview html={previewSrc} width={width} />
          </div>

          <details ref={codeRef} className="group">
            <summary className="cursor-pointer text-[10px] font-bold uppercase tracking-widest text-[var(--text-muted)] hover:text-[var(--text-primary)] outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded">Ver código HTML</summary>
            <textarea ref={codeArea} readOnly aria-label="Código HTML" value={code} className={inputCls + ' mt-2 h-64 font-mono text-[11px]'} />
          </details>
        </section>
      </div>

      {ed.conflict && (
        <ConflictDialog
          current={ed.conflict.current} names={names}
          onLoadTheirs={ed.loadTheirs} onKeepMine={ed.keepMine} onSaveCopy={saveAsCopy}
          onDiscard={() => { ed.dismissConflict(); onGone(); }}
        />
      )}
    </div>
  );
}
