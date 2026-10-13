import { useCallback, useEffect, useRef, useState } from "react";
import { errorText, supa } from "./supa.ts";

// Carga inicial + Realtime de uma tabela, no mesmo esquema das tabelas tasks/notes do
// Lumina. O "eco" do próprio save é reconhecido pelo `rev`: uma linha só substitui a
// local se for mais nova (rev maior), então a resposta do nosso UPDATE e o evento do
// Realtime para a mesma gravação não brigam entre si. Os eventos podem chegar fora de
// ordem (testado: rev 10 antes do 9) e até depois do DELETE; ids excluídos são lembrados
// para um UPDATE atrasado não fazer o template "reaparecer".

interface Versioned { id: string, rev: number }

export function useRealtimeRows<T extends Versioned>(table: string, load: () => Promise<T[]>, normalize: (raw: any) => T) {
  const [rows, setRows] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deletedRef = useRef<Set<string>>(new Set());

  const upsertLocal = useCallback((row: T) => {
    if (deletedRef.current.has(row.id)) return;
    setRows(prev => {
      const i = prev.findIndex(r => r.id === row.id);
      if (i === -1) return [row, ...prev];
      if (prev[i].rev > row.rev) return prev;
      const copy = [...prev];
      copy[i] = row;
      return copy;
    });
  }, []);

  const removeLocal = useCallback((id: string) => {
    deletedRef.current.add(id);
    setRows(prev => prev.filter(r => r.id !== id));
  }, []);

  const reload = useCallback(async () => {
    try {
      setRows(await load());
      setError(null);
    } catch (e) {
      setError('Não foi possível carregar os dados: ' + errorText(e));
    } finally {
      setLoading(false);
    }
  }, [load]);

  useEffect(() => {
    void reload();
    const client = supa();
    if (!client?.channel) return;
    const channel = client
      .channel(`lumina-${table}-realtime`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload: any) => {
        if (payload.eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (oldId) removeLocal(String(oldId));
          return;
        }
        if (payload.new?.id) upsertLocal(normalize(payload.new));
      })
      .subscribe();
    return () => { client.removeChannel(channel); };
  }, [table, reload, normalize, upsertLocal, removeLocal]);

  return { rows, loading, error, reload, upsertLocal, removeLocal };
}
