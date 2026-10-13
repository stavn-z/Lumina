import type { HistoryEntry, TemplateType } from "../types.ts";

// Port de FIELD_LABELS, ser/snapOf/diffSnap e logEdit do protótipo.
// Diferença do Lumina: cada entrada guarda `by` (responsibles.id) e edições
// seguidas só se agrupam quando são da mesma pessoa.

export const FIELD_LABELS: Record<string, string> = {
  nome: 'Nome', assunto: 'Assunto', preheader: 'Preheader', webview: 'Topo', banner: 'Imagem do topo', texto: 'Texto',
  textColor: 'Estilo do texto', fontSize: 'Estilo do texto', font: 'Estilo do texto', textAlign: 'Estilo do texto',
  btn: 'Botão', footer: 'Imagem do rodapé', bg: 'Cor de fundo', social: 'Redes sociais', vars: 'Variáveis', links: 'Links',
  header: 'Cabeçalho', buttons: 'Botões', btnMode: 'Botões',
};

export const EDIT_GROUP_MS = 15 * 60e3;
const MAX_ENTRIES = 150;

const ser = (v: unknown) => JSON.stringify(v, (_k, x) => typeof x === 'string' && x.length > 400 ? x.length + ':' + x.slice(0, 80) + x.slice(-80) : x);

/** Chaves de primeiro nível de `data` que mudaram entre duas versões. */
export function changedKeys(prev: Record<string, unknown>, next: Record<string, unknown>): string[] {
  const out: string[] = [];
  for (const k of new Set([...Object.keys(prev || {}), ...Object.keys(next || {})])) {
    if (ser(prev?.[k]) !== ser(next?.[k])) out.push(k);
  }
  return out;
}

export function fieldLabel(key: string, type: TemplateType) {
  return key === 'footer' && type !== 'email' ? 'Rodapé' : (FIELD_LABELS[key] || key);
}

/** Devolve um novo histórico com a edição registrada (não altera o original). */
export function logEdit(history: HistoryEntry[], keys: string[], type: TemplateType, by: string, now = Date.now()): HistoryEntry[] {
  const h = history.map(e => ({ ...e }));
  const fields = [...new Set(keys.map(k => fieldLabel(k, type)))];
  const last = h[h.length - 1];
  if (last && last.kind === 'edit' && now - last.t < EDIT_GROUP_MS && (last.by || '') === by) {
    last.t = now;
    last.fields = [...new Set([...(last.fields || []), ...fields])];
  } else {
    h.push({ t: now, kind: 'edit', fields, by });
  }
  if (h.length > MAX_ENTRIES) h.splice(1, h.length - MAX_ENTRIES);
  return h;
}

export function histLabel(h: HistoryEntry) {
  if (h.kind === 'created') return 'Template criado';
  if (h.kind === 'dup') return 'Criado como cópia de “' + (h.from || 'outro template') + '”';
  if (h.kind === 'rubeus_on') return 'Marcado como criado na Rubeus';
  if (h.kind === 'rubeus_off') return 'Desmarcado da Rubeus';
  if (h.kind === 'rubeus_upd') return 'Atualização na Rubeus confirmada';
  if (h.kind === 'start') return 'Início do histórico (template criado antes deste recurso)';
  return 'Alterado: ' + (h.fields || []).join(', ');
}
