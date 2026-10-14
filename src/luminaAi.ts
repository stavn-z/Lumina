// Cliente da Edge Function "lumina-ai". A chave da Anthropic fica só no servidor;
// aqui só vai a sessão do usuário logado (supabase.functions.invoke envia o JWT).
import { useCallback, useRef, useState } from "react";

export type LuminaAiAction = 'closure_email' | 'draft_task' | 'weekly_summary';

export type LuminaAiResult<T> = { ok: true, data: T } | { ok: false, error: string };

const GENERIC_ERROR = 'Não foi possível usar a IA agora. Tente de novo em instantes.';

export async function callLuminaAi<T>(action: LuminaAiAction, payload: Record<string, unknown>): Promise<LuminaAiResult<T>> {
  const supa = (window as any).supabaseClient;
  if (!supa) return { ok: false, error: GENERIC_ERROR };
  try {
    const { data, error } = await supa.functions.invoke('lumina-ai', { body: { action, payload } });
    if (error) {
      // Erros HTTP da função trazem { ok: false, error } no corpo; o resto vira mensagem genérica.
      let message = '';
      try { message = (await error.context?.json?.())?.error || ''; } catch { /* corpo não é JSON */ }
      if (!message && /Failed to fetch|NetworkError/i.test(String(error.message))) message = 'Sem conexão com o servidor.';
      return { ok: false, error: message || GENERIC_ERROR };
    }
    if (!data?.ok) return { ok: false, error: data?.error || GENERIC_ERROR };
    return { ok: true, data: data.data as T };
  } catch {
    return { ok: false, error: GENERIC_ERROR };
  }
}

/** Chamada com estado de carregamento e proteção contra clique duplo. */
export function useLuminaAi<T>(action: LuminaAiAction) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);

  const run = useCallback(async (payload: Record<string, unknown>): Promise<T | null> => {
    if (busy.current) return null;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const res = await callLuminaAi<T>(action, payload);
      if (!res.ok) { setError(res.error); return null; }
      return res.data;
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [action]);

  return { run, loading, error, clearError: () => setError('') };
}
