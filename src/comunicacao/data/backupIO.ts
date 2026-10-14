import { normalizeData, normalizeLists } from "../defaults.ts";
import { backupClients, collectDataUrls, isUuid, legacyKeyOf, replaceDataUrls, typeOfItem } from "../lib/backup.ts";
import type { BackupFile, BackupItem } from "../lib/backup.ts";
import type { TaxClientRow, TemplateRow } from "../types.ts";
import { dataUrlToBlob, uploadImage } from "./imageUpload.ts";
import { createClient, listClients } from "./taxonomyApi.ts";
import { createTemplate, existingLegacyKeys } from "./templatesApi.ts";
import { supa } from "./supa.ts";

// Importação do backup do protótipo (ou de um backup exportado pelo próprio Lumina).
// - Cada template recebe legacy_key = idOriginal:timestampDeCriação e é ignorado se já existir
//   (também é ignorado se o id for o uuid de um template que já está no banco).
// - Imagens em base64 vão para o storage e são trocadas pela URL pública.
// - Clientes da Taxonomia entram por merge: os que já existem não são alterados.

export interface ImportPlan {
  backup: BackupFile;
  newItems: BackupItem[];
  existing: number;
  newClients: { id: string, name: string, lists: any }[];
  images: number;
}

export async function planImport(backup: BackupFile): Promise<ImportPlan> {
  const seen = new Set<string>();
  const items = backup.lib.items.filter(it => it && it.data && !seen.has(legacyKeyOf(it)) && seen.add(legacyKeyOf(it)));
  const keys = await existingLegacyKeys(items.map(legacyKeyOf));
  const uuids = items.map(it => String(it.id)).filter(isUuid);
  let existingIds = new Set<string>();
  if (uuids.length) {
    const { data, error } = await supa().from('templates').select('id').in('id', uuids);
    if (error) throw error;
    existingIds = new Set((data || []).map((r: any) => r.id));
  }
  const newItems = items.filter(it => !keys.has(legacyKeyOf(it)) && !existingIds.has(String(it.id)));
  const have = new Set((await listClients()).map(c => c.id));
  const newClients = backupClients(backup).filter(c => !have.has(String(c.id)));
  const images = newItems.reduce((n, it) => n + collectDataUrls(it.data).size, 0);
  return { backup, newItems, existing: backup.lib.items.length - newItems.length, newClients, images };
}

export interface ImportResult { created: TemplateRow[], clients: TaxClientRow[], existing: number, failed: { nome: string, erro: string }[], images: number }

export async function runImport(plan: ImportPlan, userId: string, onProgress: (done: number, total: number) => void): Promise<ImportResult> {
  const res: ImportResult = { created: [], clients: [], existing: plan.existing, failed: [], images: 0 };
  const uploaded = new Map<string, string>(); // mesmo base64 (ex.: recorte e original iguais) sobe uma vez só
  let done = 0;
  onProgress(0, plan.newItems.length);
  for (const it of plan.newItems) {
    const type = typeOfItem(it);
    const nome = String(it.data?.nome || 'Sem nome');
    try {
      for (const url of collectDataUrls(it.data)) {
        if (!uploaded.has(url)) { uploaded.set(url, await uploadImage(dataUrlToBlob(url))); res.images++; }
      }
      const data = normalizeData(type, replaceDataUrls(it.data, uploaded));
      const created = it.created || it.updated || Date.now();
      const row = await createTemplate({
        type, data,
        history: Array.isArray(it.history) ? it.history : [],
        created_by: userId,
        legacy_key: legacyKeyOf(it),
        created_at: new Date(created).toISOString(),
        updated_at: new Date(it.updated || created).toISOString(),
        rubeus_done: !!it.rubeus?.done,
        rubeus_at: it.rubeus?.done && it.rubeus.at ? new Date(it.rubeus.at).toISOString() : null,
      });
      res.created.push(row);
    } catch (e: any) {
      // Corrida com outra importação simultânea: a chave já entrou — conta como existente.
      if (e?.code === '23505') res.existing++;
      else res.failed.push({ nome, erro: e?.message || String(e) });
    }
    onProgress(++done, plan.newItems.length);
  }
  for (const c of plan.newClients) {
    try { res.clients.push(await createClient({ id: String(c.id), name: String(c.name || 'Cliente'), lists: normalizeLists(c.lists) })); }
    catch (e: any) { if (e?.code !== '23505') res.failed.push({ nome: 'Cliente ' + c.name, erro: e?.message || String(e) }); }
  }
  return res;
}
