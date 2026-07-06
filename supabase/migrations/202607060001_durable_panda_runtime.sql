create extension if not exists pgcrypto;

create table if not exists public.campaigns (
  id text primary key,
  name text not null,
  brief text not null default '',
  phase text not null default 'planning',
  active_gate text not null default 'H1',
  owner_role text not null default 'Campaign Owner',
  created_by uuid,
  owner_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint campaigns_phase_check check (phase in ('brief','planning','content','localization','rollout','live','optimize','done')),
  constraint campaigns_active_gate_check check (active_gate in ('H1','H2','H3','H4','H-C','H-legal'))
);

create table if not exists public.campaign_plans (
  id bigint generated always as identity primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  version integer not null default 1,
  name text not null,
  hero_product text not null,
  markets jsonb not null default '[]'::jsonb,
  locales jsonb not null default '[]'::jsonb,
  audience jsonb not null default '[]'::jsonb,
  budget text not null default '',
  timeline text not null default '',
  channels jsonb not null default '[]'::jsonb,
  kpis jsonb not null default '[]'::jsonb,
  assumptions jsonb not null default '[]'::jsonb,
  updated_by text not null default 'panda-runtime',
  owner_id uuid,
  updated_at timestamptz not null default now(),
  unique (campaign_id, version),
  constraint campaign_plans_markets_array check (jsonb_typeof(markets) = 'array'),
  constraint campaign_plans_locales_array check (jsonb_typeof(locales) = 'array'),
  constraint campaign_plans_audience_array check (jsonb_typeof(audience) = 'array'),
  constraint campaign_plans_channels_array check (jsonb_typeof(channels) = 'array'),
  constraint campaign_plans_kpis_array check (jsonb_typeof(kpis) = 'array'),
  constraint campaign_plans_assumptions_array check (jsonb_typeof(assumptions) = 'array')
);

create table if not exists public.work_objects (
  id text not null,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  workspace text not null,
  title text not null,
  lane text not null default '',
  owner_role text not null default '',
  status text not null default 'draft',
  gate text not null,
  copy text not null default '',
  evidence jsonb not null default '[]'::jsonb,
  source text not null default 'PandaRuntime',
  updated_by text not null default 'panda-runtime',
  owner_id uuid,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, id),
  constraint work_objects_status_check check (status in ('draft','in-review','approved','revision-requested','blocked')),
  constraint work_objects_gate_check check (gate in ('H1','H2','H3','H4','H-C','H-legal')),
  constraint work_objects_workspace_check check (workspace in ('campaign-planning','content-planning','content','rollout','optimize'))
);

create table if not exists public.content_requirements (
  id text not null,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  channel text not null,
  asset_type text not null,
  title text not null,
  locale text not null default 'master',
  owner_role text not null default '',
  rollout_target text not null default '',
  status text not null default 'draft',
  evidence jsonb not null default '[]'::jsonb,
  updated_by text not null default 'panda-runtime',
  owner_id uuid,
  updated_at timestamptz not null default now(),
  primary key (campaign_id, id),
  constraint content_requirements_status_check check (status in ('draft','in-review','approved','revision-requested','blocked'))
);

create table if not exists public.agent_threads (
  id bigint generated always as identity primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  workspace text not null,
  agent_id text not null,
  visible_to_workspace boolean not null default true,
  owner_id uuid,
  created_at timestamptz not null default now(),
  unique (campaign_id, workspace, agent_id)
);

create table if not exists public.agent_messages (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.agent_threads(id) on delete cascade,
  role text not null,
  text text not null,
  model_mode text not null default 'unknown',
  owner_id uuid,
  created_at timestamptz not null default now(),
  constraint agent_messages_role_check check (role in ('user','agent','system','tool'))
);

create table if not exists public.object_revisions (
  id bigint generated always as identity primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  object_id text not null,
  object_type text not null,
  action text not null,
  before_data jsonb not null default '{}'::jsonb,
  after_data jsonb not null default '{}'::jsonb,
  rationale text not null default '',
  actor text not null default 'panda-runtime',
  owner_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.gate_decisions (
  id bigint generated always as identity primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  gate text not null,
  decision text not null,
  reviewer text not null,
  owner_id uuid,
  comment text not null default '',
  created_at timestamptz not null default now(),
  constraint gate_decisions_gate_check check (gate in ('H1','H2','H3','H4','H-C','H-legal')),
  constraint gate_decisions_decision_check check (decision in ('approved','revision-requested','blocked'))
);

create table if not exists public.runtime_events (
  id text primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  workspace text not null default 'global',
  type text not null,
  actor text not null default 'panda-runtime',
  owner_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint runtime_events_type_check check (type in ('agent_message','object_patch','gate_decision','audit','job_started','job_completed','job_failed'))
);

create table if not exists public.agent_jobs (
  id bigint generated always as identity primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  workspace text not null,
  agent_id text not null,
  job_type text not null,
  status text not null default 'queued',
  input jsonb not null default '{}'::jsonb,
  output jsonb not null default '{}'::jsonb,
  owner_id uuid,
  error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint agent_jobs_status_check check (status in ('queued','running','succeeded','failed'))
);

create index if not exists campaign_plans_campaign_id_idx on public.campaign_plans (campaign_id, version desc);
create index if not exists work_objects_campaign_workspace_idx on public.work_objects (campaign_id, workspace, status);
create index if not exists content_requirements_campaign_idx on public.content_requirements (campaign_id, channel, locale);
create index if not exists agent_threads_campaign_workspace_idx on public.agent_threads (campaign_id, workspace);
create index if not exists agent_messages_thread_created_idx on public.agent_messages (thread_id, created_at);
create index if not exists object_revisions_campaign_object_idx on public.object_revisions (campaign_id, object_id, created_at desc);
create index if not exists gate_decisions_campaign_gate_idx on public.gate_decisions (campaign_id, gate, created_at desc);
create index if not exists runtime_events_campaign_created_idx on public.runtime_events (campaign_id, created_at desc);
create index if not exists agent_jobs_campaign_status_idx on public.agent_jobs (campaign_id, status, created_at);

alter table public.campaigns enable row level security;
alter table public.campaign_plans enable row level security;
alter table public.work_objects enable row level security;
alter table public.content_requirements enable row level security;
alter table public.agent_threads enable row level security;
alter table public.agent_messages enable row level security;
alter table public.object_revisions enable row level security;
alter table public.gate_decisions enable row level security;
alter table public.runtime_events enable row level security;
alter table public.agent_jobs enable row level security;

insert into public.campaigns (id, name, brief, phase, active_gate, owner_role)
values (
  'camp_04',
  'Q4 DACH SIW 6AT-A22 paid-media campaign',
  'Existing seeded campaign for Panda prototype: SIW 6AT-A22, DACH markets, EUR 50k budget, paid media, email, organic/HN, HOL landing page, banner, and claims evidence.',
  'content',
  'H2',
  'Campaign Owner'
)
on conflict (id) do nothing;
