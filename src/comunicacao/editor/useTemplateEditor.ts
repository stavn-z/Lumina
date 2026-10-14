import { useCallback, useEffect, useRef, useState } from "react";
import { clone } from "../defaults.ts";
import { saveTemplateContent } from "../data/templatesApi.ts";
import { useAutosave } from "../data/useAutosave.ts";
import type { TemplateRow } from "../types.ts";

// Estado de edição de um template, comum aos editores de e-mail e de SMS/WhatsApp.
// - `draft` é o que está na tela; `base` é a última versão salva conhecida (com o rev).
// - Cada alteração agenda o salvamento automático (~800 ms).
// - Versão nova vinda do banco (outra pessoa, ou a flag da Rubeus) é adotada na hora se
//   não houver nada pendente; se houver, o salvamento detecta o conflito.
// - Conflito em que só mudaram metadados (flag da Rubeus/histórico) é resolvido sozinho:
//   o conteúdo da outra versão é igual ao nosso ponto de partida, então nada se perde.

export interface Conflict { current: TemplateRow | null }

export function useTemplateEditor<D>(row: TemplateRow, userId: string, upsertLocal: (r: TemplateRow) => void) {
  const [draft, setDraft] = useState<D>(() => clone(row.data));
  const draftRef = useRef<D>(draft);
  const baseRef = useRef<TemplateRow>(row);
  const [base, setBase] = useState<TemplateRow>(row);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const adoptBase = (r: TemplateRow) => { baseRef.current = r; setBase(r); };
  const replaceDraft = (d: D) => { const c = clone(d); draftRef.current = c; setDraft(c); };

  const save = useCallback(async (data: D) => {
    let res = await saveTemplateContent(baseRef.current, data, userId);
    if (res.status === 'conflict' && res.current && JSON.stringify(res.current.data) === JSON.stringify(baseRef.current.data)) {
      adoptBase(res.current);
      res = await saveTemplateContent(res.current, data, userId);
    }
    if (res.status === 'conflict') { setConflict({ current: res.current }); return 'conflict' as const; }
    adoptBase(res.row);
    if (res.status === 'ok') upsertLocal(res.row);
    return 'ok' as const;
  }, [userId, upsertLocal]);

  const autosave = useAutosave<D>(row.id, save);

  // Versão mais nova vinda da lista (Realtime ou a nossa própria flag da Rubeus).
  useEffect(() => {
    if (row.rev <= baseRef.current.rev) return;
    if (autosave.isDirty()) return;
    const sameContent = JSON.stringify(row.data) === JSON.stringify(baseRef.current.data);
    adoptBase(row);
    if (!sameContent) replaceDraft(row.data);
  }, [row]); // só reage a uma nova versão da linha

  /** Altera o rascunho (mutação sobre uma cópia) e agenda o salvamento. */
  const update = useCallback((fn: (d: D) => void) => {
    const next = clone(draftRef.current);
    fn(next);
    draftRef.current = next;
    setDraft(next);
    autosave.change(next);
  }, [autosave]);

  // Decisões do diálogo de conflito.
  const loadTheirs = () => {
    if (!conflict?.current) return;
    adoptBase(conflict.current);
    replaceDraft(conflict.current.data);
    setConflict(null);
    autosave.resolveConflict(false);
  };
  const keepMine = () => {
    if (!conflict?.current) return;
    adoptBase(conflict.current);
    setConflict(null);
    autosave.resolveConflict(true);
  };
  const dismissConflict = () => { setConflict(null); autosave.discard(); };

  return { draft, base, update, autosave, conflict, loadTheirs, keepMine, dismissConflict, draftRef };
}
