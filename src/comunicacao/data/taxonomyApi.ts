import { normalizeLists } from "../defaults.ts";
import type { TaxClientRow, TaxLists } from "../types.ts";
import { supa } from "./supa.ts";

// Leitura e escrita de `taxonomy_clients` (clientes e cadastros da Taxonomia),
// com o mesmo controle otimista por `rev` dos templates.

const TABLE = 'taxonomy_clients';

export type TaxWriteResult =
  | { status: 'ok', row: TaxClientRow }
  | { status: 'conflict', current: TaxClientRow | null };

export function normalizeClient(raw: any): TaxClientRow {
  return { ...raw, name: raw.name || '', lists: normalizeLists(raw.lists), rev: Number(raw.rev) || 1 };
}

export async function listClients(): Promise<TaxClientRow[]> {
  const { data, error } = await supa().from(TABLE).select('*').order('created_at', { ascending: true });
  if (error) throw error;
  return (data || []).map(normalizeClient);
}

export async function getClient(id: string): Promise<TaxClientRow | null> {
  const { data, error } = await supa().from(TABLE).select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? normalizeClient(data) : null;
}

export const newClientId = () => 'c' + Date.now().toString(36);

export async function createClient(c: { id?: string, name: string, lists: TaxLists }): Promise<TaxClientRow> {
  const { data, error } = await supa().from(TABLE).insert([{ id: c.id || newClientId(), name: c.name, lists: c.lists }]).select('*').single();
  if (error) throw error;
  return normalizeClient(data);
}

export async function saveClient(base: TaxClientRow, patch: { name?: string, lists?: TaxLists }): Promise<TaxWriteResult> {
  const { data, error } = await supa().from(TABLE).update(patch).eq('id', base.id).eq('rev', base.rev).select('*').maybeSingle();
  if (error) throw error;
  if (data) return { status: 'ok', row: normalizeClient(data) };
  return { status: 'conflict', current: await getClient(base.id) };
}

export async function deleteClient(id: string): Promise<void> {
  const { error } = await supa().from(TABLE).delete().eq('id', id);
  if (error) throw error;
}
