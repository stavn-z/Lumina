-- =====================================================================
-- Lumina · Comunicação · Etapa 1
-- Tabelas templates e taxonomy_clients, RLS, realtime e bucket "imagens".
-- Rodar UMA vez no SQL Editor do Supabase. Tudo roda numa transação:
-- se algo falhar, nada é aplicado. Só CRIA objetos novos; não altera
-- nenhuma tabela, política ou bucket existente do Lumina.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- TEMPLATES
-- updated_at = última alteração de CONTEÚDO (coluna data). Marcar ou
-- desmarcar "Criado na Rubeus" não altera esse carimbo (ver trigger).
-- rev = versão da linha, sobe a cada UPDATE; usada para detectar que
-- outra pessoa salvou o mesmo template antes (update ... where rev = ?).
-- ---------------------------------------------------------------------
create table public.templates (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('email', 'sms', 'whatsapp')),
  data        jsonb not null default '{}'::jsonb,
  nome        text generated always as (coalesce(data->>'nome', '')) stored,
  history     jsonb not null default '[]'::jsonb,
  rubeus_done boolean not null default false,
  rubeus_at   timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  text,          -- responsibles.id de quem criou
  updated_by  text,          -- responsibles.id de quem alterou o conteúdo por último
  legacy_key  text unique,   -- idOriginal:timestampDeCriação (importação do protótipo)
  rev         bigint not null default 1
);

create index templates_created_at_idx on public.templates (created_at desc);

create or replace function public.templates_before_update() returns trigger
language plpgsql as $$
begin
  new.created_at := old.created_at;
  new.created_by := old.created_by;
  new.rev := old.rev + 1;
  if new.data is distinct from old.data then
    new.updated_at := now();
  else
    new.updated_at := old.updated_at;
    new.updated_by := old.updated_by;
  end if;
  -- Hora da marcação vem do servidor: o app envia rubeus_at = null e o banco preenche.
  -- No "Desfazer", o app envia o rubeus_at anterior explicitamente e ele é mantido.
  if new.rubeus_done and new.rubeus_at is null then
    new.rubeus_at := now();
  end if;
  if not new.rubeus_done then
    new.rubeus_at := null;
  end if;
  return new;
end $$;

create trigger templates_before_update
  before update on public.templates
  for each row execute function public.templates_before_update();

-- ---------------------------------------------------------------------
-- TAXONOMIA (clientes e cadastros). A seleção do formulário e os nomes
-- recentes ficam no navegador de cada pessoa, não aqui.
-- ---------------------------------------------------------------------
create table public.taxonomy_clients (
  id         text primary key,
  name       text not null,
  lists      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rev        bigint not null default 1
);

create or replace function public.taxonomy_clients_before_update() returns trigger
language plpgsql as $$
begin
  new.created_at := old.created_at;
  new.rev := old.rev + 1;
  new.updated_at := now();
  return new;
end $$;

create trigger taxonomy_clients_before_update
  before update on public.taxonomy_clients
  for each row execute function public.taxonomy_clients_before_update();

-- ---------------------------------------------------------------------
-- RLS: qualquer usuário autenticado lê e escreve (a equipe compartilha tudo)
-- ---------------------------------------------------------------------
alter table public.templates enable row level security;
alter table public.taxonomy_clients enable row level security;

create policy "templates: equipe autenticada" on public.templates
  for all to authenticated using (true) with check (true);

create policy "taxonomy_clients: equipe autenticada" on public.taxonomy_clients
  for all to authenticated using (true) with check (true);

-- ---------------------------------------------------------------------
-- REALTIME (outro usuário cria/edita e a tela atualiza sozinha)
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.templates, public.taxonomy_clients;

-- ---------------------------------------------------------------------
-- SEED: cliente padrão Celso Lisboa (só se a tabela estiver vazia)
-- ---------------------------------------------------------------------
insert into public.taxonomy_clients (id, name, lists)
select 'celso', 'Celso Lisboa', '{
  "centro": [{"l":"Captação","c":"CAP"},{"l":"Financeiro","c":"FIN"},{"l":"Apoio","c":"APO"},{"l":"Outros","c":"OUT"}],
  "canal": [{"l":"WhatsApp","c":"WPP"},{"l":"E-mail","c":"EML"},{"l":"SMS","c":"SMS"},{"l":"RCS","c":"RCS"}],
  "processo": [{"l":"Graduação","c":"GRD"},{"l":"Pós","c":"POS"},{"l":"Ambos","c":"AMB"}],
  "unidade": [{"l":"Engenho Novo","c":"EN"},{"l":"Bangu","c":"BG"},{"l":"Campo Grande","c":"CG"},{"l":"Tijuca","c":"TJ"},{"l":"Zona Oeste","c":"ZO"}],
  "modalidade": [{"l":"EAD","c":"EAD"},{"l":"Presencial","c":"PRE"},{"l":"Semipresencial","c":"SEM"},{"l":"Inscrito","c":"INS"},{"l":"Inscrito parcial","c":"INSP"}],
  "tipo": [{"l":"Primeiro contato","c":"PRM"},{"l":"Repique","c":"REP"}]
}'::jsonb
where not exists (select 1 from public.taxonomy_clients);

-- ---------------------------------------------------------------------
-- STORAGE: bucket público "imagens" (URL permanente para Gmail/Outlook).
-- Sem policies de UPDATE/DELETE: um arquivo enviado nunca é sobrescrito.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imagens', 'imagens', true, 5242880, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
on conflict (id) do nothing;

create policy "imagens: upload autenticado" on storage.objects
  for insert to authenticated with check (bucket_id = 'imagens');

create policy "imagens: leitura pública" on storage.objects
  for select to public using (bucket_id = 'imagens');

commit;
