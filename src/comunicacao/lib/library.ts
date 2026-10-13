import type { TemplateRow, TemplateType } from "../types.ts";

// Regras da aba "Meus templates": busca (norm/fieldText), status na Rubeus (rbState),
// ordenação e formatação de datas — port do protótipo.

export const TYPES: Record<TemplateType, string> = { email: 'E-mail', sms: 'SMS', whatsapp: 'WhatsApp' };

export const SEARCH_FIELDS: [string, string][] = [
  ['all', 'Todos os campos'], ['nome', 'Nome'], ['assunto', 'Assunto'], ['texto', 'Texto'],
  ['preheader', 'Preheader'], ['cabecalho', 'Cabeçalho'], ['botoes', 'Botões'], ['rodape', 'Rodapé'],
];

export type RbFilter = 'all' | 'pending' | 'done' | 'changed';
export const STATUS_OPTIONS: [RbFilter, string][] = [
  ['all', 'Todos os status'], ['pending', 'Pendentes na Rubeus'], ['done', 'Criados na Rubeus'], ['changed', 'Alterados após criar'],
];

export type SortKey = 'created' | 'updated' | 'name';
export const SORT_OPTIONS: [SortKey, string][] = [['created', 'Criação: mais recentes'], ['updated', 'Última alteração'], ['name', 'Nome (A–Z)']];

export const norm = (t: unknown) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function fieldText(it: TemplateRow, f: string) {
  const d = it.data, em = it.type === 'email';
  const parts: Record<string, string> = {
    nome: d.nome, assunto: d.assunto,
    texto: d.texto,
    preheader: em ? d.preheader : '',
    cabecalho: em ? '' : (d.header && d.header.type === 'text' ? d.header.text : ''),
    botoes: em ? (d.btn && d.btn.text) : (d.buttons || []).map((b: any) => b.text).join(' '),
    rodape: em ? (d.social && d.social.on ? [d.social.title, d.social.contato].join(' ') : '') : (d.footer && d.footer.type === 'text' ? d.footer.text : ''),
  };
  return f === 'all' ? Object.values(parts).join(' ') : (parts[f] || '');
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

export type RbState = 'pending' | 'done' | 'changed';

/** pendente; criado; ou "alterado após criar" (conteúdo mudou depois da marcação). */
export function rbState(it: TemplateRow): RbState {
  if (!it.rubeus_done) return 'pending';
  return ms(it.updated_at) > ms(it.rubeus_at) + 1000 ? 'changed' : 'done';
}

export function sortTemplates(items: TemplateRow[], key: SortKey) {
  const cmp = key === 'updated'
    ? (a: TemplateRow, b: TemplateRow) => ms(b.updated_at) - ms(a.updated_at)
    : key === 'name'
      ? (a: TemplateRow, b: TemplateRow) => String(a.data.nome || '').localeCompare(String(b.data.nome || ''), 'pt-BR')
      : (a: TemplateRow, b: TemplateRow) => ms(b.created_at) - ms(a.created_at);
  return [...items].sort(cmp);
}

export const fmtDate = (t: string | number | null) => {
  if (t == null || t === '') return '';
  try { return new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às'); } catch { return ''; }
};
