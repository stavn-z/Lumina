import { useState } from "react";
import { DatabaseBackup } from "lucide-react";
import { planImport, runImport } from "../data/backupIO.ts";
import { errorText } from "../data/supa.ts";
import { backupFileName, parseBackup, toBackup } from "../lib/backup.ts";
import { useAsk } from "../ui/Dialogs.tsx";
import { useToast } from "../ui/Toast.tsx";
import type { TaxClientRow, TemplateRow } from "../types.ts";

// Exportar e importar backup (formato do protótipo), a partir da aba Meus templates.
export function useBackup({ userId, rows, clients, upsertTemplate, upsertClient }: {
  userId: string, rows: TemplateRow[], clients: TaxClientRow[],
  upsertTemplate: (r: TemplateRow) => void, upsertClient: (c: TaxClientRow) => void,
}) {
  const ask = useAsk();
  const toast = useToast();
  const [progress, setProgress] = useState<string | null>(null);

  function exportBackup() {
    let local: { cur?: string, sels?: Record<string, any>, recent?: string[] } = {};
    try { local = JSON.parse(localStorage.getItem(`lumina_com_tax:${userId}`) || '{}') || {}; } catch {}
    const sorted = [...clients].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const payload = toBackup(rows, sorted, { cur: local.cur, sel: local.cur ? local.sels?.[local.cur] : undefined, recent: local.recent });
    try {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      a.download = backupFileName();
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast('Backup baixado: ' + rows.length + (rows.length === 1 ? ' template' : ' templates'));
    } catch { toast('Não foi possível baixar o backup'); }
  }

  async function importFile(file: File | undefined) {
    if (!file) return;
    const backup = parseBackup(await file.text());
    if (!backup) { toast('Esse arquivo não é um backup do gerador'); return; }
    let plan;
    try { setProgress('Analisando…'); plan = await planImport(backup); }
    catch (e) { toast('Não foi possível ler o backup: ' + errorText(e)); return; }
    finally { setProgress(null); }
    const total = backup.lib.items.length;
    if (!plan.newItems.length && !plan.newClients.length) {
      void ask({ title: 'Nada novo para importar', message: `Os ${total} templates desse backup já existem aqui. Nada foi alterado.`, ok: 'Fechar', noCancel: true, icon: <DatabaseBackup size={24} /> });
      return;
    }
    const msg = `${plan.newItems.length} de ${total} templates são novos e serão adicionados. Os que já existem aqui não são alterados.`
      + (plan.images ? ` ${plan.images} ${plan.images === 1 ? 'imagem embutida será enviada' : 'imagens embutidas serão enviadas'} ao armazenamento.` : '')
      + (plan.newClients.length ? ` ${plan.newClients.length} ${plan.newClients.length === 1 ? 'cliente' : 'clientes'} da Taxonomia também ${plan.newClients.length === 1 ? 'entra' : 'entram'}.` : '');
    if (!await ask({ title: 'Importar backup?', message: msg, ok: 'Importar', icon: <DatabaseBackup size={24} /> })) return;
    try {
      const res = await runImport(plan, userId, (d, t) => setProgress(`Importando ${d} de ${t}…`));
      res.created.forEach(upsertTemplate);
      res.clients.forEach(upsertClient);
      void ask({
        title: 'Backup importado',
        icon: <DatabaseBackup size={24} />,
        message: `${res.created.length} ${res.created.length === 1 ? 'novo' : 'novos'}, ${res.existing} já ${res.existing === 1 ? 'existia' : 'existiam'}.`
          + (res.images ? ` ${res.images} ${res.images === 1 ? 'imagem foi enviada' : 'imagens foram enviadas'} ao armazenamento.` : '')
          + (res.clients.length ? ` ${res.clients.length} ${res.clients.length === 1 ? 'cliente novo' : 'clientes novos'} na Taxonomia.` : ''),
        content: res.failed.length ? (
          <div className="text-xs rounded-xl px-3 py-2.5 bg-red-500/10 border border-red-500/20 text-red-400">
            <b className="block mb-1">Não foi possível importar:</b>
            <ul className="list-disc pl-4">{res.failed.map((f, i) => <li key={i}>{f.nome}: {f.erro}</li>)}</ul>
          </div>
        ) : undefined,
        ok: 'Fechar', noCancel: true,
      });
    } catch (e) { toast('Erro ao importar: ' + errorText(e)); }
    finally { setProgress(null); }
  }

  return { exportBackup, importFile, progress };
}
