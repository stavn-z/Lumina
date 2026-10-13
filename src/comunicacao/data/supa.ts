// O Lumina cria o cliente do Supabase via CDN em window.supabaseClient (App.tsx).
// O módulo reaproveita a mesma instância (e a mesma sessão do usuário logado).
export function supa(): any {
  const client = (window as any).supabaseClient;
  if (!client) throw new Error('Supabase ainda não foi inicializado.');
  return client;
}

/** Mensagem de erro legível a partir de um erro do Supabase ou de rede. */
export function errorText(err: any): string {
  const msg = err?.message || String(err || '');
  if (/Failed to fetch|NetworkError|network/i.test(msg)) return 'Sem conexão com o servidor.';
  return msg || 'Erro desconhecido.';
}
