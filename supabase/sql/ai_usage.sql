-- Registro de chamadas à Edge Function lumina-ai, para o limite de usos por hora.
-- Só a função (com a service role) lê e grava: RLS ligado e nenhuma policy para usuários.
create table if not exists public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_user_created_idx on public.ai_usage (user_id, created_at desc);

alter table public.ai_usage enable row level security;
