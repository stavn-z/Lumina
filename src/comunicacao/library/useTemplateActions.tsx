import { Copy, History, Plus } from "lucide-react";
import { clone, DEFAULT, txDefault } from "../defaults.ts";
import { createTemplate, deleteTemplate, setRubeus } from "../data/templatesApi.ts";
import { errorText } from "../data/supa.ts";
import { histLabel } from "../lib/history.ts";
import { fmtDate, rbState, TYPES } from "../lib/library.ts";
import { useAsk } from "../ui/Dialogs.tsx";
import { useToast } from "../ui/Toast.tsx";
import type { HistoryEntry, HistoryKind, TemplateRow, TemplateType } from "../types.ts";

interface Deps {
  userId: string;
  names: Record<string, string>;
  upsertLocal: (r: TemplateRow) => void;
  removeLocal: (id: string) => void;
  onOpen: (id: string) => void;
  onDeleted: (id: string) => void;
}

// Ações da aba "Meus templates" — mesma lógica e textos do protótipo, gravando no banco.
export function useTemplateActions({ userId, names, upsertLocal, removeLocal, onOpen, onDeleted }: Deps) {
  const ask = useAsk();
  const toast = useToast();
  const fail = (what: string, e: unknown) => toast(`Não foi possível ${what}: ${errorText(e)}`);

  async function create(defaultType: TemplateType) {
    const r = await ask<{ text: string, choice: string } | null>({
      title: 'Novo template', icon: <Plus size={24} />,
      message: 'Escolha o tipo e dê um nome. E-mail começa com o layout de exemplo; SMS e WhatsApp, com um texto de exemplo.',
      select: [['email', 'E-mail'], ['whatsapp', 'WhatsApp'], ['sms', 'SMS']], selectValue: defaultType, selectLabel: 'Tipo',
      input: true, inputLabel: 'Nome do template', placeholder: 'Ex.: CAP_EML_GRD_EN_EAD_PRM_C1', ok: 'Criar',
    });
    if (!r) return;
    const name = (r.text || '').trim();
    if (!name) { toast('Dê um nome ao template'); return; }
    const type = r.choice as TemplateType;
    let data;
    if (type === 'email') { data = clone(DEFAULT); data.nome = name; } else { data = txDefault(type); data.nome = type === 'whatsapp' ? name.toLowerCase() : name; }
    try {
      const row = await createTemplate({ type, data, history: [{ t: Date.now(), kind: 'created', by: userId }], created_by: userId });
      upsertLocal(row);
      onOpen(row.id);
      toast('Template criado');
    } catch (e) { fail('criar o template', e); }
  }

  async function duplicate(src: TemplateRow) {
    const nome = src.data.nome || 'Sem nome';
    if (!await ask({ title: 'Duplicar template?', icon: <Copy size={24} />, message: `Uma cópia de “${nome}” será criada no topo da lista.`, ok: 'Duplicar' })) return;
    const data = clone(src.data);
    data.nome = (data.nome || 'template') + '_copia'; // a cópia nasce pendente na Rubeus
    try {
      const row = await createTemplate({ type: src.type, data, history: [{ t: Date.now(), kind: 'dup', from: nome, by: userId }], created_by: userId });
      upsertLocal(row);
      toast('Cópia criada no topo da lista');
    } catch (e) { fail('duplicar', e); }
  }

  async function remove(row: TemplateRow) {
    if (!await ask({ title: 'Excluir template?', message: `“${row.data.nome || 'Sem nome'}” será excluído para toda a equipe. Essa ação não pode ser desfeita.`, ok: 'Excluir', tone: 'danger' })) return;
    try {
      await deleteTemplate(row.id);
      removeLocal(row.id);
      onDeleted(row.id);
      toast('Template excluído');
    } catch (e) { fail('excluir', e); }
  }

  // Um clique marca/desmarca, sem pop-up; o toast oferece "Desfazer".
  async function toggleRubeus(row: TemplateRow) {
    const st = rbState(row);
    const now = Date.now();
    const kind: HistoryKind = st === 'pending' ? 'rubeus_on' : st === 'changed' ? 'rubeus_upd' : 'rubeus_off';
    const done = st !== 'done';
    const msg = st === 'pending' ? 'Marcado como criado na Rubeus' : st === 'changed' ? 'Atualização na Rubeus confirmada' : 'Desmarcado da Rubeus';
    const prev = { done: row.rubeus_done, at: row.rubeus_at };
    const entry: HistoryEntry = { t: now, kind, by: userId };
    try {
      const res = await setRubeus(row, r => ({ done, at: null, history: [...r.history, entry] }));
      if (res.status !== 'ok') { toast('Este template não existe mais'); return; }
      upsertLocal(res.row);
      toast(msg, {
        label: 'Desfazer',
        run: async () => {
          try {
            const back = await setRubeus(res.row, r => ({ done: prev.done, at: prev.at, history: r.history.filter(h => !(h.t === now && h.kind === kind)) }));
            if (back.status === 'ok') { upsertLocal(back.row); toast('Desfeito'); }
          } catch (e) { fail('desfazer', e); }
        },
      });
    } catch (e) { fail('atualizar a marcação da Rubeus', e); }
  }

  function showHistory(row: TemplateRow) {
    const items = [...(row.history || [])].reverse();
    void ask({
      title: 'Histórico · ' + (row.data.nome || 'Sem nome'), icon: <History size={24} />,
      message: `${TYPES[row.type]} criado em ${fmtDate(row.created_at)}. Edições feitas em sequência (até 15 minutos de intervalo) pela mesma pessoa aparecem agrupadas.`,
      content: <HistoryList items={items} names={names} />,
      ok: 'Fechar', noCancel: true, wide: true,
    });
  }

  return { create, duplicate, remove, toggleRubeus, showHistory };
}

const DOT: Partial<Record<HistoryKind, string>> = { edit: 'bg-indigo-500', dup: 'bg-amber-500', created: 'bg-emerald-500', rubeus_on: 'bg-emerald-500', rubeus_upd: 'bg-emerald-500', rubeus_off: 'bg-[var(--text-muted)]' };

function HistoryList({ items, names }: { items: HistoryEntry[], names: Record<string, string> }) {
  if (!items.length) return <p className="text-sm text-[var(--text-muted)]">Sem registros.</p>;
  return (
    <ul className="flex flex-col">
      {items.map((h, i) => (
        <li key={i} className="grid grid-cols-[12px_1fr] gap-3 py-2.5 border-b last:border-b-0" style={{ borderColor: 'var(--border-primary)' }}>
          <span className={`w-2.5 h-2.5 rounded-full mt-1.5 ${DOT[h.kind] || 'bg-indigo-500'}`} />
          <div className="min-w-0">
            <b className="block text-sm font-semibold text-[var(--text-primary)] break-words">{histLabel(h)}</b>
            <span className="text-xs text-[var(--text-muted)]">{fmtDate(h.t)}{h.by && names[h.by] ? ` · ${names[h.by]}` : ''}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}
