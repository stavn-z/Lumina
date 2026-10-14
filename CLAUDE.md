## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Módulo Comunicação (templates de e-mail, SMS e WhatsApp)

Exceção à regra de manter tudo em `src/App.tsx`: o módulo vive em `src/comunicacao/`. No App.tsx há só o import, o item "Comunicação" no menu lateral (e no menu do avatar no celular) e a renderização em `OverlayModal` com `activeTab === 'comunicacao'`.

- Estrutura: `ComunicacaoArea.tsx` (abas Meus templates, Editor e Taxonomia), `lib/` (funções puras), `data/` (Supabase, salvamento automático, realtime), `editor/`, `library/`, `taxonomy/`, `ui/` (toast e diálogos próprios do módulo).
- Banco (SQL em `src/comunicacao/sql/`): tabelas `templates` e `taxonomy_clients`, RLS liberando leitura e escrita a qualquer usuário autenticado, bucket público `imagens`.
- `templates.updated_at` é a data da última alteração de CONTEÚDO: o trigger só a atualiza quando `data` muda. Marcar/desmarcar "Criado na Rubeus" não pode mexer nela, senão o estado "Alterado após criar" quebra.
- Toda escrita usa controle otimista por `rev` (`update … where rev = ?`); conflito abre o aviso de edição simultânea. `created_by`/`updated_by` guardam o `responsibles.id` (o `user.id` do Lumina).
- O formato de `data` é o mesmo do protótipo `docs/gerador-email.html`, para o backup dele importar sem conversão. Imagens sempre como URL pública do storage, nunca base64.
- O HTML do e-mail (`lib/emailHtml.ts`) tem de ser IDÊNTICO ao do protótipo. Depois de mexer nele, rode `node scripts/verificar-email-html.mjs`.
- A padronização de texto das demandas (caixa alta etc.) NÃO vale para os templates. O nome do template de WhatsApp é sempre minúsculo.
- Seleção do formulário da Taxonomia e nomes recentes ficam no localStorage de cada pessoa; clientes e cadastros, no banco.
