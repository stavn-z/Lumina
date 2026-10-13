import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { LayoutGrid, PenLine, Tag } from "lucide-react";

// Área "Comunicação": templates de e-mail, SMS e WhatsApp e taxonomia de nomes.
// Renderizada dentro do OverlayModal do App.tsx (activeTab === 'comunicacao').

export type ComTab = 'lib' | 'editor' | 'tax';

const TABS: { id: ComTab, label: string, short?: string, icon: ReactNode }[] = [
  { id: 'lib', label: 'Meus templates', short: 'Templates', icon: <LayoutGrid size={14} /> },
  { id: 'editor', label: 'Editor', icon: <PenLine size={14} /> },
  { id: 'tax', label: 'Taxonomia', icon: <Tag size={14} /> },
];

const tabKey = (userId: string) => `lumina_com_tab:${userId}`;

function readTab(userId: string): ComTab {
  try {
    const v = localStorage.getItem(tabKey(userId));
    if (v === 'lib' || v === 'editor' || v === 'tax') return v;
  } catch {}
  return 'lib';
}

export default function ComunicacaoArea({ user, onClose }: { user: { id: string, name: string }, onClose: () => void }) {
  const [tab, setTab] = useState<ComTab>(() => readTab(user.id));

  useEffect(() => {
    try { localStorage.setItem(tabKey(user.id), tab); } catch {}
  }, [tab, user.id]);

  // O OverlayModal do Lumina não fecha com Esc; a área trata isso por conta própria.
  // Diálogos internos (etapas seguintes) param a propagação do Esc antes de chegar aqui.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

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
        {tab === 'lib' && <EmptyState icon={<LayoutGrid size={28} />} title="Meus templates" text="Os templates de e-mail, SMS e WhatsApp da equipe vão aparecer aqui." />}
        {tab === 'editor' && <EmptyState icon={<PenLine size={28} />} title="Nenhum template aberto" text="Abra um template em Meus templates para editar." />}
        {tab === 'tax' && <EmptyState icon={<Tag size={28} />} title="Taxonomia" text="Gere o nome padronizado da campanha ou do template." />}
      </div>
    </div>
  );
}

function EmptyState({ icon, title, text }: { icon: ReactNode, title: string, text: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-16 px-4 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-primary)' }}>
      <div className="p-3 rounded-2xl text-indigo-400" style={{ background: 'var(--bg-overlay)' }}>{icon}</div>
      <h3 className="font-display font-bold text-base" style={{ color: 'var(--text-primary)' }}>{title}</h3>
      <p className="text-sm max-w-sm" style={{ color: 'var(--text-muted)' }}>{text}</p>
    </div>
  );
}
