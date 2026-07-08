create table if not exists public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  status text not null default 'needs_auth',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_connections_provider_check check (provider in ('figma')),
  constraint integration_connections_status_check check (status in ('needs_auth','connected','expired','revoked','error'))
);

create index if not exists integration_connections_provider_status_updated_idx
  on public.integration_connections (provider, status, updated_at desc);

create unique index if not exists integration_connections_provider_unique_idx
  on public.integration_connections (provider);

alter table public.integration_connections enable row level security;

drop policy if exists "service role manages integration connections" on public.integration_connections;
create policy "service role manages integration connections"
  on public.integration_connections
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.integration_oauth_states (
  state text primary key,
  provider text not null,
  code_verifier text not null,
  redirect_uri text not null,
  client_id text not null,
  client_secret text,
  metadata jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint integration_oauth_states_provider_check check (provider in ('figma'))
);

create index if not exists integration_oauth_states_provider_expires_idx
  on public.integration_oauth_states (provider, expires_at desc);

alter table public.integration_oauth_states enable row level security;

drop policy if exists "service role manages integration oauth states" on public.integration_oauth_states;
create policy "service role manages integration oauth states"
  on public.integration_oauth_states
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
