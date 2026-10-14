import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { LayoutGrid, PenLine, Tag } from "lucide-react";
import "./comunicacao.css";
import { clone } from "./defaults.ts";
import { errorText, supa } from "./data/supa.ts";
import { saveTemplateContent } from "./data/templatesApi.ts";
import { useTaxonomyClients, useTemplates } from "./data/useComData.ts";
import { EmailEditor } from "./editor/EmailEditor.tsx";
import { TextEditor } from "./editor/TextEditor.tsx";
import { LibraryTab } from "./library/LibraryTab.tsx";
import { useBackup } from "./library/useBackup.tsx";
import { useTemplateActions } from "./library/useTemplateActions.tsx";
import { TaxonomyTab } from "./taxonomy/TaxonomyTab.tsx";
import { DialogProvider } from "./ui/Dialogs.tsx";
import { ToastProvider, useToast } from "./ui/Toast.tsx";

// Área "Comunicação": templates de e-mail, SMS e WhatsApp e taxonomia de nomes.
// Renderizada dentro do OverlayModal do App.tsx (activeTab === 'comunicacao').

export type ComTab = 'lib' | 'editor' | 'tax';

interface ComUser { id: string, name: string }

const TABS: { id: ComTab, label: string, short?: string, icon: ReactNode }[] = [
  { id: 'lib', label: 'Meus templates', short: 'Templates', icon: <LayoutGrid size={14} /> },
  { id: 'editor', label: 'Editor', icon: <PenLine size={14} /> },
  { id: 'tax', label: 'Taxonomia', icon: <Tag size={14} /> },
];

// Conveniências por usuário neste navegador: aba atual e template aberto.
function useStored(key: string, initial: string | null) {
  const [v, setV] = useState<string | null>(() => { try { return localStorage.getItem(key) ?? initial; } catch { return initial; } });
  useEffect(() => { try { if (v == null) localStorage.removeItem(key); else localStorage.setItem(key, v); } catch {} }, [key, v]);
  return [v, setV] as const;
}

export default function ComunicacaoArea({ user, onClose }: { user: ComUser, onClose: () => void }) {
  return (
    <ToastProvider>
      <DialogProvider>
        <Area user={user} onClose={onClose} />
      </DialogProvider>
    </ToastProvider>
  );
}

function Area({ user, onClose }: { user: ComUser, onClose: () => void }) {
  const [storedTab, setTab] = useStored(`lumina_com_tab:${user.id}`, 'lib');
  const tab: ComTab = storedTab === 'editor' || storedTab === 'tax' ? storedTab : 'lib';
  const [openId, setOpenId] = useStored(`lumina_com_open:${user.id}`, null);
  const { rows, loading, error, upsertLocal, removeLocal } = useTemplates();
  const tax = useTaxonomyClients();
  const toast = useToast();
  const [names, setNames] = useState<Record<string, string>>({});

  // Nomes da equipe para o histórico ("Alterado · Ana").
  useEffect(() => {
    supa().from('responsibles').select('id,name').then(({ data }: any) => {
      if (data) setNames(Object.fromEntries(data.map((r: any) => [r.id, r.name])));
    });
  }, []);

  // O OverlayModal do Lumina não fecha com Esc; a área trata isso por conta própria.
  // Os diálogos internos capturam o Esc antes (preventDefault), então só um fecha por vez.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const openTemplate = useCallback((id: string) => { setOpenId(id); setTab('editor'); }, [setOpenId, setTab]);
  const actions = useTemplateActions({
    userId: user.id, names, upsertLocal, removeLocal,
    onOpen: openTemplate,
    onDeleted: id => { if (id === openId) setOpenId(null); },
  });

  const backup = useBackup({ userId: user.id, rows, clients: tax.rows, upsertTemplate: upsertLocal, upsertClient: tax.upsertLocal });
  const openRow = rows.find(r => r.id === openId) || null;
  // Se o template aberto for excluído por outra pessoa, o editor continua montado com a
  // última versão conhecida: sem nada pendente ele fecha; com edição pendente, o salvamento
  // cai no aviso de conflito (que oferece salvar a versão como novo template).
  const lastOpen = useRef<typeof openRow>(null);
  if (openRow) lastOpen.current = openRow;
  const editRow = openRow || (lastOpen.current && lastOpen.current.id === openId ? lastOpen.current : null);

  // "Usar no template" da Taxonomia: grava o nome no template aberto e leva para o editor.
  // Só o nome muda, então um conflito de versão é resolvido reaplicando sobre a versão atual.
  async function useNameInTemplate(name: string) {
    if (!openRow) { toast('Abra um template em Meus templates antes de usar o nome'); return false; }
    const nome = openRow.type === 'whatsapp' ? name.toLowerCase() : name;
    try {
      let base = openRow;
      for (let i = 0; i < 3; i++) {
        const res = await saveTemplateContent(base, { ...clone(base.data), nome }, user.id);
        if (res.status === 'conflict') { if (!res.current) { toast('Este template não existe mais'); return false; } base = res.current; continue; }
        upsertLocal(res.row);
        setTab('editor');
        toast('Nome aplicado ao template aberto');
        return true;
      }
      toast('Não foi possível aplicar o nome agora. Tente de novo.');
    } catch (e) { toast('Não foi possível aplicar o nome: ' + errorText(e)); }
    return false;
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-5">
      <div role="tablist" aria-label="Seções da Comunicação" className="grid grid-cols-3 sm:flex gap-1 p-1 rounded-xl border sm:self-start" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
        {TABS.map(t => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`com-tab-${t.id}`}
              aria-selected={on}
              aria-controls={`com-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`flex items-center justify-center gap-2 px-2 sm:px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest whitespace-nowrap transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${on ? 'bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-overlay)]'}`}
            >
              <span className="hidden sm:inline-flex">{t.icon}</span>{t.short ? <><span className="sm:hidden">{t.short}</span><span className="hidden sm:inline">{t.label}</span></> : t.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`com-panel-${tab}`} aria-labelledby={`com-tab-${tab}`} className="flex-1 min-h-0 flex flex-col">
        {tab === 'lib' && (
          <LibraryTab
            userId={user.id}
            rows={rows}
            loading={loading}
            error={error}
            openId={openId}
            onNew={actions.create}
            onOpen={r => openTemplate(r.id)}
            onDuplicate={actions.duplicate}
            onHistory={actions.showHistory}
            onDelete={actions.remove}
            onToggleRubeus={actions.toggleRubeus}
            onExport={backup.exportBackup}
            onImport={f => void backup.importFile(f)}
            backupProgress={backup.progress}
          />
        )}
        {tab === 'editor' && editRow && (() => {
          const Editor = editRow.type === 'email' ? EmailEditor : TextEditor;
          return <Editor key={editRow.id} row={editRow} deleted={!openRow} userId={user.id} names={names} upsertLocal={upsertLocal} onToggleRubeus={actions.toggleRubeus} onGone={() => setOpenId(null)} />;
        })()}
        {tab === 'editor' && !editRow && <EmptyState icon={<PenLine size={28} />} title={loading ? 'Carregando…' : 'Nenhum template aberto'} text="Abra um template em Meus templates para editar." />}
        {tab === 'tax' && (
          <TaxonomyTab
            userId={user.id} clients={tax.rows} loading={tax.loading} error={tax.error}
            upsertLocal={tax.upsertLocal} removeLocal={tax.removeLocal} onUseName={useNameInTemplate}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode, title: string, text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 px-4 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="p-3 rounded-2xl text-indigo-400" style={{ background: 'var(--bg-overlay)' }}>{icon}</div>
      <h3 className="font-display font-bold text-base break-all" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>{text}</p>
    </div>
  );
}
