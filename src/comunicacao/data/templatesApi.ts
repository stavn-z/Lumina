import { normalizeData } from "../defaults.ts";
import { changedKeys, logEdit } from "../lib/history.ts";
import type { HistoryEntry, TemplateRow, TemplateType } from "../types.ts";
import { supa } from "./supa.ts";

// Leitura e escrita da tabela `templates`.
// Toda escrita de uma linha existente usa controle otimista por `rev`: o UPDATE só
// acontece se a versão no banco ainda for a que o app conhece. Se outra pessoa salvou
// antes, nada é gravado e o chamador recebe a versão atual para decidir o que fazer.

const TABLE = 'templates';

export type WriteResult =
  | { status: 'ok', row: TemplateRow }
  | { status: 'conflict', current: TemplateRow | null }; // null = template foi excluído

export function normalizeRow(raw: any): TemplateRow {
  const type: TemplateType = raw.type === 'sms' || raw.type === 'whatsapp' ? raw.type : 'email';
  return {
    ...raw,
    type,
    data: normalizeData(type, raw.data),
    history: Array.isArray(raw.history) ? raw.history : [],
    rubeus_done: !!raw.rubeus_done,
    rev: Number(raw.rev) || 1,
  };
}

export async function listTemplates(): Promise<TemplateRow[]> {
  const { data, error } = await supa().from(TABLE).select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(normalizeRow);
}

export async function getTemplate(id: string): Promise<TemplateRow | null> {
  const { data, error } = await supa().from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalizeRow(data) : null;
}

export interface NewTemplate {
  type: TemplateType;
  data: unknown;
  history: HistoryEntry[];
  created_by: string;
  // Usados só pela importação de backup:
  legacy_key?: string;
  created_at?: string;
  updated_at?: string;
  rubeus_done?: boolean;
  rubeus_at?: string | null;
}

export async function createTemplate(t: NewTemplate): Promise<TemplateRow> {
  const { data, error } = await supa().from(TABLE)
    .insert([{ ...t, updated_by: t.created_by }])
    .select('*').single();
  if (error) throw error;
  return normalizeRow(data);
}

async function updateIfRev(id: string, rev: number, patch: Record<string, unknown>): Promise<WriteResult> {
  const { data, error } = await supa().from(TABLE).update(patch).eq('id', id).eq('rev', rev).select('*').maybeSingle();
  if (error) throw error;
  if (data) return { status: 'ok', row: normalizeRow(data) };
  return { status: 'conflict', current: await getTemplate(id) };
}

/**
 * Salva o conteúdo (`data`) de um template, registrando no histórico os campos
 * alterados. `base` é a última versão salva que o app conhece (inclusive o `rev`).
 * Sem mudança real de conteúdo, não grava nada.
 */
export async function saveTemplateContent(base: TemplateRow, data: unknown, by: string): Promise<WriteResult | { status: 'unchanged', row: TemplateRow }> {
  const keys = changedKeys(base.data, data as Record<string, unknown>);
  if (!keys.length) return { status: 'unchanged', row: base };
  const history = logEdit(base.history, keys, base.type, by);
  return updateIfRev(base.id, base.rev, { data, history, updated_by: by });
}

/**
 * Altera a flag "Criado na Rubeus". `at = null` com `done = true` faz o banco usar a
 * hora do servidor. Para o "Desfazer", passe o `at` anterior explicitamente.
 * Como a flag não depende do conteúdo, em caso de conflito a ação é reaplicada sobre a
 * versão atual (até 3 tentativas), em vez de pedir decisão ao usuário.
 */
export async function setRubeus(
  base: TemplateRow,
  build: (row: TemplateRow) => { done: boolean, at: string | null, history: HistoryEntry[] },
): Promise<WriteResult> {
  let row: TemplateRow | null = base;
  for (let i = 0; i < 3 && row; i++) {
    const n = build(row);
    const res = await updateIfRev(row.id, row.rev, { rubeus_done: n.done, rubeus_at: n.done ? n.at : null, history: n.history });
    if (res.status === 'ok') return res;
    row = res.current;
  }
  return { status: 'conflict', current: row };
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supa().from(TABLE).delete().eq('id', id);
  if (error) throw error;
}

/** Chaves legacy_key já existentes (para a importação não duplicar). */
export async function existingLegacyKeys(keys: string[]): Promise<Set<string>> {
  if (!keys.length) return new Set();
  const { data, error } = await supa().from(TABLE).select('legacy_key').in('legacy_key', keys);
  if (error) throw error;
  return new Set((data || []).map((r: any) => r.legacy_key));
}
