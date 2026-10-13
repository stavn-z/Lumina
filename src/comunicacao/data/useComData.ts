import { listClients, normalizeClient } from "./taxonomyApi.ts";
import { listTemplates, normalizeRow } from "./templatesApi.ts";
import { useRealtimeRows } from "./useRealtimeRows.ts";
import type { TaxClientRow, TemplateRow } from "../types.ts";

/** Templates da equipe (todos os tipos), sempre em sincronia com o banco. */
export function useTemplates() {
  return useRealtimeRows<TemplateRow>('templates', listTemplates, normalizeRow);
}

/** Clientes e cadastros da Taxonomia, sempre em sincronia com o banco. */
export function useTaxonomyClients() {
  return useRealtimeRows<TaxClientRow>('taxonomy_clients', listClients, normalizeClient);
}
