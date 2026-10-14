import type { HistoryEntry, TaxClientRow, TemplateRow, TemplateType } from "../types.ts";

// Backup no formato do protótipo (docs/gerador-email.html, botão "Exportar backup"):
// { app: 'gerador-email', version: 1, exportedAt, lib: { cur, items }, taxonomy }.
// Itens: { id, type, created, updated, history, rubeus?, data } com datas em milissegundos.
// O mesmo arquivo serve para importar no Lumina e no próprio protótipo.

export interface BackupItem {
  id: string;
  type?: TemplateType;
  created?: number;
  updated?: number;
  history?: HistoryEntry[];
  rubeus?: { done: boolean, at?: number } | null;
  data: any;
}

export interface BackupFile {
  app: 'gerador-email';
  version: number;
  exportedAt: string;
  lib: { cur?: string, items: BackupItem[] };
  taxonomy: { clients: { id: string, name: string, lists: any, sel?: any }[], cur?: string, sel?: any, recent?: string[], v?: number } | null;
}

const ms = (iso: string | null) => (iso ? new Date(iso).getTime() : 0);

export function toBackup(rows: TemplateRow[], clients: TaxClientRow[], local: { cur?: string, sel?: any, recent?: string[] }, now = new Date()): BackupFile {
  const items: BackupItem[] = rows.map(r => ({
    id: r.id,
    type: r.type,
    created: ms(r.created_at),
    updated: ms(r.updated_at),
    history: r.history || [],
    rubeus: r.rubeus_done ? { done: true, at: ms(r.rubeus_at) } : { done: false },
    data: r.data,
  }));
  return {
    app: 'gerador-email',
    version: 1,
    exportedAt: now.toISOString(),
    lib: { cur: items[0]?.id, items },
    // v: 2 evita que o protótipo reaplique a migração antiga dos cadastros da Celso Lisboa.
    taxonomy: { clients: clients.map(c => ({ id: c.id, name: c.name, lists: c.lists })), cur: local.cur, sel: local.sel, recent: local.recent || [], v: 2 },
  };
}

export const backupFileName = (d = new Date()) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `gerador-email-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
};

/** Valida o arquivo como o protótipo faz; devolve null se não for um backup do gerador. */
export function parseBackup(text: string): BackupFile | null {
  let data: any;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || data.app !== 'gerador-email' || !data.lib || !Array.isArray(data.lib.items)) return null;
  return data as BackupFile;
}

export const typeOfItem = (it: BackupItem): TemplateType => (it.type === 'sms' || it.type === 'whatsapp' ? it.type : 'email');

/** Chave que impede importar o mesmo template duas vezes: idOriginal:timestampDeCriação. */
export const legacyKeyOf = (it: BackupItem) => String(it.id) + ':' + String(it.created ?? it.updated ?? 0);

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Todas as imagens em base64 (data:image/…) dentro do conteúdo de um template. */
export function collectDataUrls(v: unknown, out = new Set<string>()): Set<string> {
  if (typeof v === 'string') { if (v.startsWith('data:image/')) out.add(v); }
  else if (Array.isArray(v)) v.forEach(x => collectDataUrls(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => collectDataUrls(x, out));
  return out;
}

/** Cópia do conteúdo com cada base64 trocado pela URL correspondente. */
export function replaceDataUrls<T>(v: T, map: Map<string, string>): T {
  if (typeof v === 'string') return (map.get(v) ?? v) as T;
  if (Array.isArray(v)) return v.map(x => replaceDataUrls(x, map)) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, replaceDataUrls(x, map)])) as T;
  return v;
}

/** Clientes da taxonomia do backup (aceita também o formato antigo, com `lists` direto). */
export function backupClients(b: BackupFile): { id: string, name: string, lists: any }[] {
  const t: any = b.taxonomy;
  if (!t) return [];
  if (Array.isArray(t.clients)) return t.clients.filter((c: any) => c && c.id && c.lists);
  if (t.lists) return [{ id: 'celso', name: 'Celso Lisboa', lists: t.lists }];
  return [];
}
