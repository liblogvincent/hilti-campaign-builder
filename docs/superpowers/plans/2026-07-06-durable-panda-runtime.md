# Durable Panda Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Panda's localStorage-first prototype runtime with a Supabase-backed durable runtime and Vercel AI SDK transport, so agent claims, visible workspaces, object revisions, and audit traces all read from the same canonical campaign state.

**Architecture:** Supabase/Postgres becomes the source of truth for campaigns, plans, work objects, chats, revisions, gates, jobs, and runtime events. Vercel AI SDK becomes the streaming-capable AI transport, while Panda keeps a custom product-specific runtime for H1-H4 gates, specialist policy, action validation, and human approval. The frontend stops applying scattered state patches directly and instead calls runtime APIs that persist changes, emit audit events, and return a refreshed campaign snapshot.

**Tech Stack:** React 18 + TypeScript + Vite, Vercel serverless functions, Vercel AI SDK (`ai`, `@ai-sdk/openai`), DeepSeek through OpenAI-compatible provider config, Supabase/Postgres (`@supabase/supabase-js`), Vitest.

## Implementation Status

**Status as of 2026-07-07:** Implemented and verified in code. The unchecked task boxes below are preserved as the original execution recipe, but the runtime slice now exists in the repo:

- Supabase durable schema and seed migration: `supabase/migrations/202607060001_durable_panda_runtime.sql`
- Runtime mode/client boundary: `server/supabase-client.mjs`, `server/runtime-schema.mjs`
- Campaign snapshot runtime: `server/campaign-runtime.mjs`
- Runtime action executor and revision/event helpers: `server/object-runtime.mjs`, `server/runtime-events.mjs`
- Durable agent thread/message persistence: `server/agent-runtime.mjs`
- Vercel AI SDK transport option for DeepSeek: `server/ai-transport.mjs`
- Durable API routing for `/api/agent`, `/api/orchestrator`, and `/api/gate-decision`: `server/panda-api.mjs`
- UI runtime snapshot/trace binding: `src/lib/panda.ts`, `src/main.tsx`
- Deployment guide and env variables: `.env.example`, `README.md`, `docs/deployment/vercel-durable-runtime.md`

Fresh verification:

- `npm test` -> 4 files / 157 tests passed
- `npm run build` -> Vite production build passed

Remaining operational steps before a Supabase-backed live demo:

- Apply the migration to the target Supabase project.
- Set Vercel env vars from `docs/deployment/vercel-durable-runtime.md`.
- Deploy first with `PANDA_RUNTIME_MODE=local`, then switch preview to `PANDA_RUNTIME_MODE=supabase`.
- Smoke-test real Supabase persistence for Home, Campaign Planning, Content Planning, gate decisions, and Runtime Trace.

## Global Constraints

- Do not push to GitHub or Vercel until Vincent explicitly approves.
- Do not expose API keys, tokens, or contents of `C:\Users\tutuclaw\Documents\APIs, log-ins and other information.md`.
- Keep DeepSeek as the first live model provider.
- Use Supabase now for durable state.
- Use Vercel AI SDK for the recommended AI transport path.
- Keep Panda's custom Orchestrator + specialist runtime; do not replace it with a generic agent framework.
- Home Panda remains the global orchestrator.
- Workspace agents remain specialists with isolated visible chat histories.
- Shared campaign context is allowed; shared rendered chat history is not.
- No auto-publish. H3 remains the human publish/spend authorization gate.
- Gate approval remains object-aware: object-level approvals roll up to final gate readiness.
- Preserve a local/fixture mode for offline prototype demos.
- Use lowercase Postgres identifiers and indexed foreign keys.
- Enable RLS-ready ownership fields in every runtime table even if the first demo uses a service role on the server.

---

## File Structure

- Create: `supabase/migrations/202607060001_durable_panda_runtime.sql`
  - Owns the durable runtime schema, constraints, RLS enablement, indexes, and `camp_04` seed data.
- Create: `server/supabase-client.mjs`
  - Owns Supabase server client creation and runtime mode detection.
- Create: `server/runtime-schema.mjs`
  - Owns small validation helpers and constants for phases, gates, views, object statuses, agent scopes, and action names.
- Create: `server/campaign-runtime.mjs`
  - Owns campaign snapshot loading, campaign creation, plan persistence, and fixture-to-durable seed helpers.
- Create: `server/object-runtime.mjs`
  - Owns work object updates, content requirement updates, plan-level field updates, revision creation, and gate readiness.
- Create: `server/agent-runtime.mjs`
  - Owns agent thread/message persistence, context packet assembly from Supabase, agent job creation, and action execution orchestration.
- Modify: `server/runtime-events.mjs`
  - Extend helper-only events into persistable event envelopes.
- Modify: `server/ai-transport.mjs`
  - Keep compatibility wrapper and add Vercel AI SDK provider adapter.
- Modify: `server/panda-api.mjs`
  - Route orchestrator and agent calls through runtime services when `PANDA_RUNTIME_MODE=supabase`.
- Create: `server/runtime-api.test.mjs`
  - Unit tests for runtime validators, action executor behavior, and fixture repository behavior.
- Modify: `server/panda-api.test.mjs`
  - Tests for AI transport mode selection and persisted runtime responses.
- Modify: `src/lib/panda.ts`
  - Add durable snapshot types and client-side normalizers.
- Modify: `src/main.tsx`
  - Replace direct canonical object mutation with runtime API calls and refreshed snapshots.
- Modify: `src/styles.css`
  - Add visible "Updated by Panda" and trace/activity affordances.
- Modify: `.env.example`
  - Add Supabase, runtime mode, and Vercel AI SDK model variables.
- Modify: `README.md`
  - Add local Supabase setup, Vercel env vars, and runtime mode notes.
- Modify: `package.json`
  - Add `@supabase/supabase-js`, `ai`, and `@ai-sdk/openai`.

---

### Task 1: Add Supabase Runtime Schema and Seed

**Files:**
- Create: `supabase/migrations/202607060001_durable_panda_runtime.sql`
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces tables: `campaigns`, `campaign_plans`, `work_objects`, `content_requirements`, `agent_threads`, `agent_messages`, `object_revisions`, `gate_decisions`, `runtime_events`, `agent_jobs`.
- Produces seed campaign: `camp_04`.

- [ ] **Step 1: Create the migration directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path supabase/migrations
```

Expected: directory exists.

- [ ] **Step 2: Create the runtime schema migration**

Create `supabase/migrations/202607060001_durable_panda_runtime.sql` with this SQL:

```sql
create extension if not exists pgcrypto;

create table if not exists public.campaigns (
  id text primary key,
  name text not null,
  brief text not null default '',
  phase text not null default 'planning',
  active_gate text not null default 'H1',
  owner_role text not null default 'Campaign Owner',
  created_by uuid,
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
  created_at timestamptz not null default now(),
  unique (campaign_id, workspace, agent_id)
);

create table if not exists public.agent_messages (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.agent_threads(id) on delete cascade,
  role text not null,
  text text not null,
  model_mode text not null default 'unknown',
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
  created_at timestamptz not null default now()
);

create table if not exists public.gate_decisions (
  id bigint generated always as identity primary key,
  campaign_id text not null references public.campaigns(id) on delete cascade,
  gate text not null,
  decision text not null,
  reviewer text not null,
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
```

- [ ] **Step 3: Add runtime environment variables**

Append to `.env.example`:

```powershell
PANDA_RUNTIME_MODE=local
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
PANDA_AI_TRANSPORT=vercel-ai
PANDA_DEFAULT_MODEL=deepseek-chat
```

- [ ] **Step 4: Document setup**

Add a README section named `Durable Runtime` with:

```md
## Durable Runtime

Set `PANDA_RUNTIME_MODE=supabase` to use Supabase/Postgres as the source of truth.

Required server-side variables:

```powershell
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PANDA_AI_TRANSPORT=vercel-ai
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

Keep `PANDA_RUNTIME_MODE=local` for offline demo mode.
```

- [ ] **Step 5: Verify migration syntax**

Run:

```powershell
npm test
```

Expected: existing tests pass because schema files are not executed by Vitest.

- [ ] **Step 6: Commit**

```powershell
git add supabase/migrations/202607060001_durable_panda_runtime.sql .env.example README.md
git commit -m "feat: add durable panda runtime schema"
```

---

### Task 2: Add Supabase Client and Runtime Mode Boundary

**Files:**
- Create: `server/supabase-client.mjs`
- Create: `server/runtime-schema.mjs`
- Create: `server/runtime-api.test.mjs`
- Modify: `server/panda-api.test.mjs`

**Interfaces:**
- Produces: `runtimeMode(env): "local" | "supabase"`
- Produces: `createSupabaseServerClient(env): SupabaseClient | undefined`
- Produces: `assertRuntimeStatus(status): string`

- [ ] **Step 1: Add dependencies**

Run:

```powershell
npm install @supabase/supabase-js
```

Expected: `package.json` and `package-lock.json` include `@supabase/supabase-js`.

- [ ] **Step 2: Write failing runtime boundary tests**

Create `server/runtime-api.test.mjs`:

```js
import { describe, expect, it } from "vitest";
import { runtimeMode, canUseSupabase, createSupabaseServerClient } from "./supabase-client.mjs";
import { assertRuntimeStatus, normalizeWorkspace } from "./runtime-schema.mjs";

describe("runtime mode", () => {
  it("defaults to local runtime", () => {
    expect(runtimeMode({})).toBe("local");
  });

  it("uses supabase only when explicitly selected and configured", () => {
    const env = {
      PANDA_RUNTIME_MODE: "supabase",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };
    expect(runtimeMode(env)).toBe("supabase");
    expect(canUseSupabase(env)).toBe(true);
  });

  it("falls back to local when supabase mode is missing credentials", () => {
    expect(runtimeMode({ PANDA_RUNTIME_MODE: "supabase" })).toBe("local");
  });

  it("creates no client in local mode", () => {
    expect(createSupabaseServerClient({ PANDA_RUNTIME_MODE: "local" })).toBeUndefined();
  });
});

describe("runtime schema helpers", () => {
  it("normalizes unknown workspace to home", () => {
    expect(normalizeWorkspace("bad")).toBe("home");
  });

  it("accepts valid work object statuses", () => {
    expect(assertRuntimeStatus("in-review")).toBe("in-review");
  });

  it("rejects invalid work object statuses", () => {
    expect(() => assertRuntimeStatus("published")).toThrow("Invalid runtime status");
  });
});
```

- [ ] **Step 3: Run failing tests**

Run:

```powershell
npm test -- server/runtime-api.test.mjs
```

Expected: FAIL because `server/supabase-client.mjs` and `server/runtime-schema.mjs` do not exist.

- [ ] **Step 4: Implement `server/runtime-schema.mjs`**

Create:

```js
export const WORKSPACES = new Set(["home", "campaign-planning", "content-planning", "content", "rollout", "optimize", "progress", "skills"]);
export const WORK_OBJECT_STATUSES = new Set(["draft", "in-review", "approved", "revision-requested", "blocked"]);
export const GATES = new Set(["H1", "H2", "H3", "H4", "H-C", "H-legal"]);
export const AGENT_ACTIONS = new Set([
  "update_campaign_plan",
  "update_planning_object",
  "update_content_requirements",
  "update_content_object",
  "update_rollout_lane",
  "create_gate_decision",
]);

export function normalizeWorkspace(value) {
  return WORKSPACES.has(value) ? value : "home";
}

export function assertRuntimeStatus(value) {
  if (!WORK_OBJECT_STATUSES.has(value)) {
    throw new Error(`Invalid runtime status: ${value}`);
  }
  return value;
}

export function assertGate(value) {
  if (!GATES.has(value)) {
    throw new Error(`Invalid gate: ${value}`);
  }
  return value;
}

export function assertAgentAction(value) {
  if (!AGENT_ACTIONS.has(value)) {
    throw new Error(`Invalid agent action: ${value}`);
  }
  return value;
}
```

- [ ] **Step 5: Implement `server/supabase-client.mjs`**

Create:

```js
import { createClient } from "@supabase/supabase-js";

export function canUseSupabase(env = process.env) {
  return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY);
}

export function runtimeMode(env = process.env) {
  return env.PANDA_RUNTIME_MODE === "supabase" && canUseSupabase(env) ? "supabase" : "local";
}

export function createSupabaseServerClient(env = process.env) {
  if (runtimeMode(env) !== "supabase") return undefined;
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
```

- [ ] **Step 6: Verify**

Run:

```powershell
npm test -- server/runtime-api.test.mjs
npm test
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json server/supabase-client.mjs server/runtime-schema.mjs server/runtime-api.test.mjs
git commit -m "feat: add panda runtime mode boundary"
```

---

### Task 3: Build Campaign Snapshot Runtime

**Files:**
- Create: `server/campaign-runtime.mjs`
- Modify: `server/runtime-api.test.mjs`

**Interfaces:**
- Produces: `loadCampaignSnapshot({ campaignId, supabase, fixture })`
- Produces: `createCampaignSnapshotFromFixture(run)`
- Produces snapshot shape: `{ campaign, plan, workObjects, contentRequirements, gateDecisions, events, agentThreads }`

- [ ] **Step 1: Add fixture snapshot tests**

Append to `server/runtime-api.test.mjs`:

```js
import { createCampaignSnapshotFromFixture } from "./campaign-runtime.mjs";
import { createDefaultRun, campaignPlanForRun, campaignPlanningObjectsFromPlan, contentRequirementsFromPlan } from "../src/lib/panda.ts";

describe("campaign snapshot runtime", () => {
  it("creates a canonical snapshot from fixture state", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const snapshot = createCampaignSnapshotFromFixture({
      run,
      plan,
      planningObjects: campaignPlanningObjectsFromPlan(plan),
      contentRequirements: contentRequirementsFromPlan(plan),
    });

    expect(snapshot.campaign.id).toBe(run.campaignId);
    expect(snapshot.plan.campaignId).toBe(run.campaignId);
    expect(snapshot.workObjects.some((item) => item.workspace === "campaign-planning")).toBe(true);
    expect(snapshot.contentRequirements.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm test -- server/runtime-api.test.mjs
```

Expected: FAIL because `server/campaign-runtime.mjs` does not exist.

- [ ] **Step 3: Implement fixture snapshot adapter**

Create `server/campaign-runtime.mjs`:

```js
export function createCampaignSnapshotFromFixture({ run, plan, planningObjects, contentRequirements, gateDecisions = [], events = [], agentThreads = [] }) {
  return {
    campaign: {
      id: run.campaignId,
      name: run.name,
      brief: run.brief,
      phase: run.phase,
      activeGate: run.currentGate?.id || "H1",
      ownerRole: "Campaign Owner",
      updatedAt: new Date().toISOString(),
    },
    plan,
    workObjects: planningObjects.map((item) => ({
      ...item,
      campaignId: run.campaignId,
      workspace: "campaign-planning",
    })),
    contentRequirements,
    gateDecisions,
    events,
    agentThreads,
  };
}

export async function loadCampaignSnapshot({ campaignId, supabase, fixture }) {
  if (!supabase) return fixture;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError) throw campaignError;

  const [{ data: plans, error: planError }, { data: workObjects, error: workError }, { data: contentRequirements, error: reqError }, { data: gateDecisions, error: gateError }, { data: events, error: eventError }] = await Promise.all([
    supabase.from("campaign_plans").select("*").eq("campaign_id", campaignId).order("version", { ascending: false }).limit(1),
    supabase.from("work_objects").select("*").eq("campaign_id", campaignId),
    supabase.from("content_requirements").select("*").eq("campaign_id", campaignId),
    supabase.from("gate_decisions").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }),
    supabase.from("runtime_events").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(50),
  ]);

  for (const error of [planError, workError, reqError, gateError, eventError]) {
    if (error) throw error;
  }

  return {
    campaign: mapCampaign(campaign),
    plan: mapPlan(plans?.[0]),
    workObjects: workObjects || [],
    contentRequirements: contentRequirements || [],
    gateDecisions: gateDecisions || [],
    events: events || [],
    agentThreads: [],
  };
}

function mapCampaign(row) {
  return {
    id: row.id,
    name: row.name,
    brief: row.brief,
    phase: row.phase,
    activeGate: row.active_gate,
    ownerRole: row.owner_role,
    updatedAt: row.updated_at,
  };
}

function mapPlan(row) {
  if (!row) return undefined;
  return {
    campaignId: row.campaign_id,
    name: row.name,
    heroProduct: row.hero_product,
    markets: row.markets,
    locales: row.locales,
    audience: row.audience,
    budget: row.budget,
    timeline: row.timeline,
    channels: row.channels,
    kpis: row.kpis,
    assumptions: row.assumptions,
  };
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm test -- server/runtime-api.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/campaign-runtime.mjs server/runtime-api.test.mjs
git commit -m "feat: add campaign snapshot runtime"
```

---

### Task 4: Add Agent Action Executor and Object Revisions

**Files:**
- Create: `server/object-runtime.mjs`
- Modify: `server/runtime-events.mjs`
- Modify: `server/runtime-api.test.mjs`

**Interfaces:**
- Produces: `executeRuntimeAction({ action, campaignId, workspace, actor, supabase, fixtureSnapshot })`
- Produces actions: `update_campaign_plan`, `update_planning_object`, `update_content_requirements`

- [ ] **Step 1: Add action executor tests**

Append to `server/runtime-api.test.mjs`:

```js
import { executeRuntimeAction } from "./object-runtime.mjs";

describe("runtime action executor", () => {
  it("updates plan markets in fixture mode and records a revision", async () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const snapshot = createCampaignSnapshotFromFixture({
      run,
      plan,
      planningObjects: campaignPlanningObjectsFromPlan(plan),
      contentRequirements: contentRequirementsFromPlan(plan),
    });

    const result = await executeRuntimeAction({
      action: {
        action: "update_campaign_plan",
        targetId: "campaign-plan",
        note: "Update markets to China, Japan, and Australia.",
        payload: { markets: ["China", "Japan", "Australia"], locales: ["zh-CN", "ja-JP", "en-AU"] },
      },
      campaignId: run.campaignId,
      workspace: "campaign-planning",
      actor: "campaign-planning-specialist",
      fixtureSnapshot: snapshot,
    });

    expect(result.snapshot.plan.markets).toEqual(["China", "Japan", "Australia"]);
    expect(result.snapshot.plan.locales).toEqual(["zh-CN", "ja-JP", "en-AU"]);
    expect(result.revisions).toHaveLength(1);
    expect(result.events[0].type).toBe("object_patch");
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm test -- server/runtime-api.test.mjs
```

Expected: FAIL because `executeRuntimeAction` does not exist.

- [ ] **Step 3: Implement fixture action executor**

Create `server/object-runtime.mjs`:

```js
import { assertAgentAction, assertRuntimeStatus } from "./runtime-schema.mjs";
import { createObjectPatchEvent } from "./runtime-events.mjs";

export async function executeRuntimeAction({ action, campaignId, workspace, actor, supabase, fixtureSnapshot }) {
  assertAgentAction(action.action);
  if (!supabase) {
    return executeFixtureAction({ action, campaignId, workspace, actor, snapshot: fixtureSnapshot });
  }
  return executeSupabaseAction({ action, campaignId, workspace, actor, supabase });
}

function executeFixtureAction({ action, campaignId, workspace, actor, snapshot }) {
  if (action.action === "update_campaign_plan") {
    const before = snapshot.plan;
    const after = {
      ...before,
      ...(Array.isArray(action.payload?.markets) ? { markets: action.payload.markets } : {}),
      ...(Array.isArray(action.payload?.locales) ? { locales: action.payload.locales } : {}),
      ...(Array.isArray(action.payload?.audience) ? { audience: action.payload.audience } : {}),
      ...(typeof action.payload?.budget === "string" ? { budget: action.payload.budget } : {}),
      ...(Array.isArray(action.payload?.kpis) ? { kpis: action.payload.kpis } : {}),
    };
    const nextSnapshot = { ...snapshot, plan: after };
    return {
      snapshot: nextSnapshot,
      revisions: [revision({ campaignId, objectId: "campaign-plan", objectType: "campaign_plan", action, before, after, actor })],
      events: [createObjectPatchEvent({ campaignId, workspace, objectId: "campaign-plan", action: action.action, note: action.note, actor, patch: action.payload })],
    };
  }

  if (action.action === "update_planning_object") {
    const beforeObject = snapshot.workObjects.find((item) => item.id === action.targetId);
    if (!beforeObject) return { snapshot, revisions: [], events: [] };
    const afterObject = {
      ...beforeObject,
      ...(action.status ? { status: assertRuntimeStatus(action.status) } : {}),
      ...(typeof action.payload?.copy === "string" ? { copy: action.payload.copy } : {}),
    };
    const nextSnapshot = {
      ...snapshot,
      workObjects: snapshot.workObjects.map((item) => (item.id === action.targetId ? afterObject : item)),
    };
    return {
      snapshot: nextSnapshot,
      revisions: [revision({ campaignId, objectId: action.targetId, objectType: "work_object", action, before: beforeObject, after: afterObject, actor })],
      events: [createObjectPatchEvent({ campaignId, workspace, objectId: action.targetId, action: action.action, note: action.note, actor, patch: action.payload })],
    };
  }

  return { snapshot, revisions: [], events: [] };
}

async function executeSupabaseAction({ action, campaignId, workspace, actor, supabase }) {
  if (action.action === "update_campaign_plan") {
    const { data: currentPlans, error: planError } = await supabase
      .from("campaign_plans")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false })
      .limit(1);
    if (planError) throw planError;
    const current = currentPlans?.[0];
    const next = {
      ...current,
      version: Number(current.version || 1) + 1,
      markets: Array.isArray(action.payload?.markets) ? action.payload.markets : current.markets,
      locales: Array.isArray(action.payload?.locales) ? action.payload.locales : current.locales,
      audience: Array.isArray(action.payload?.audience) ? action.payload.audience : current.audience,
      budget: typeof action.payload?.budget === "string" ? action.payload.budget : current.budget,
      kpis: Array.isArray(action.payload?.kpis) ? action.payload.kpis : current.kpis,
      updated_by: actor,
      updated_at: new Date().toISOString(),
    };
    delete next.id;

    const { error: insertError } = await supabase.from("campaign_plans").insert(next);
    if (insertError) throw insertError;

    const event = createObjectPatchEvent({ campaignId, workspace, objectId: "campaign-plan", action: action.action, note: action.note, actor, patch: action.payload });
    await persistRevisionAndEvent({ supabase, campaignId, objectId: "campaign-plan", objectType: "campaign_plan", action, before: current, after: next, actor, event });
    return { snapshot: undefined, revisions: [], events: [event] };
  }

  throw new Error(`Unsupported Supabase action: ${action.action}`);
}

async function persistRevisionAndEvent({ supabase, campaignId, objectId, objectType, action, before, after, actor, event }) {
  const { error: revisionError } = await supabase.from("object_revisions").insert({
    campaign_id: campaignId,
    object_id: objectId,
    object_type: objectType,
    action: action.action,
    before_data: before,
    after_data: after,
    rationale: action.note,
    actor,
  });
  if (revisionError) throw revisionError;

  const { error: eventError } = await supabase.from("runtime_events").insert({
    id: event.id,
    campaign_id: event.campaignId,
    workspace: event.workspace,
    type: event.type,
    actor: event.actor,
    payload: event.payload,
    created_at: event.timestamp,
  });
  if (eventError) throw eventError;
}

function revision({ campaignId, objectId, objectType, action, before, after, actor }) {
  return {
    campaignId,
    objectId,
    objectType,
    action: action.action,
    before,
    after,
    rationale: action.note,
    actor,
    createdAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm test -- server/runtime-api.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add server/object-runtime.mjs server/runtime-api.test.mjs server/runtime-events.mjs
git commit -m "feat: add panda runtime action executor"
```

---

### Task 5: Add Vercel AI SDK Transport

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `server/ai-transport.mjs`
- Modify: `server/panda-api.test.mjs`

**Interfaces:**
- Produces: `resolveProviderConfig(env).transport === "vercel-ai" | "fetch" | "fixture"`
- Keeps: `callJsonAgent({ payload, systemPrompt, fallback, normalize, env, fetchImpl })`

- [ ] **Step 1: Install Vercel AI SDK**

Run:

```powershell
npm install ai @ai-sdk/openai
```

Expected: `package.json` includes `ai` and `@ai-sdk/openai`.

- [ ] **Step 2: Add transport selection tests**

Add to `server/panda-api.test.mjs`:

```js
it("selects Vercel AI SDK transport when configured", () => {
  const config = resolveProviderConfig({
    PANDA_AI_TRANSPORT: "vercel-ai",
    DEEPSEEK_API_KEY: "sk-test",
    DEEPSEEK_BASE_URL: "https://api.deepseek.com",
    DEEPSEEK_MODEL: "deepseek-chat",
  });

  expect(config.mode).toBe("deepseek");
  expect(config.transport).toBe("vercel-ai");
});
```

- [ ] **Step 3: Run failing test**

Run:

```powershell
npm test -- server/panda-api.test.mjs
```

Expected: FAIL because transport is not returned yet.

- [ ] **Step 4: Update `resolveProviderConfig`**

In `server/ai-transport.mjs`, add `transport`:

```js
transport: env.PANDA_AI_TRANSPORT === "vercel-ai" ? "vercel-ai" : "fetch",
```

- [ ] **Step 5: Add Vercel AI SDK private helper**

In `server/ai-transport.mjs`, add:

```js
async function callVercelAiSdk({ config, payload, systemPrompt }) {
  const { generateText } = await import("ai");
  const { createOpenAI } = await import("@ai-sdk/openai");
  const deepseek = createOpenAI({
    apiKey: config.apiKey,
    baseURL: `${config.baseUrl.replace(/\/$/, "")}/v1`,
  });
  const result = await generateText({
    model: deepseek(config.model),
    system: systemPrompt,
    prompt: JSON.stringify(payload),
    temperature: 0.2,
  });
  return { ok: true, text: result.text };
}
```

Then in `callJsonAgent`, branch before fetch-style calls:

```js
const result = config.transport === "vercel-ai"
  ? await callVercelAiSdk({ config, payload, systemPrompt })
  : config.style === "anthropic"
  ? await callAnthropicStyle({ config, payload, systemPrompt, fallback, fetchImpl })
  : await callOpenAiStyle({ config, payload, systemPrompt, fallback, fetchImpl });
```

- [ ] **Step 6: Verify**

Run:

```powershell
npm test -- server/panda-api.test.mjs
npm test
npm run build
```

Expected: all pass.

- [ ] **Step 7: Commit**

```powershell
git add package.json package-lock.json server/ai-transport.mjs server/panda-api.test.mjs
git commit -m "feat: add vercel ai sdk transport"
```

---

### Task 6: Persist Agent Threads, Messages, and Runtime Events

**Files:**
- Create: `server/agent-runtime.mjs`
- Modify: `server/runtime-api.test.mjs`
- Modify: `server/panda-api.mjs`

**Interfaces:**
- Produces: `appendAgentMessage({ campaignId, workspace, agentId, role, text, modelMode, supabase })`
- Produces: `loadAgentHistory({ campaignId, workspace, agentId, supabase, limit })`
- Produces: `persistRuntimeEvent({ event, supabase })`

- [ ] **Step 1: Add fixture tests**

Append:

```js
import { appendAgentMessageToFixture, loadAgentHistoryFromFixture } from "./agent-runtime.mjs";

describe("agent runtime messages", () => {
  it("keeps specialist history scoped by workspace", () => {
    const store = {};
    appendAgentMessageToFixture(store, { campaignId: "camp_04", workspace: "campaign-planning", agentId: "campaign-planning-specialist", role: "user", text: "update markets" });
    appendAgentMessageToFixture(store, { campaignId: "camp_04", workspace: "content", agentId: "content-specialist", role: "user", text: "revise copy" });

    expect(loadAgentHistoryFromFixture(store, { campaignId: "camp_04", workspace: "campaign-planning", agentId: "campaign-planning-specialist" }).map((m) => m.text)).toEqual(["update markets"]);
  });
});
```

- [ ] **Step 2: Implement fixture and Supabase message functions**

Create `server/agent-runtime.mjs`:

```js
export function fixtureThreadKey({ campaignId, workspace, agentId }) {
  return `${campaignId}:${workspace}:${agentId}`;
}

export function appendAgentMessageToFixture(store, message) {
  const key = fixtureThreadKey(message);
  store[key] = [...(store[key] || []), { ...message, createdAt: new Date().toISOString() }];
  return store[key].at(-1);
}

export function loadAgentHistoryFromFixture(store, query) {
  return store[fixtureThreadKey(query)] || [];
}

export async function appendAgentMessage({ campaignId, workspace, agentId, role, text, modelMode = "unknown", supabase }) {
  const threadId = await ensureThread({ campaignId, workspace, agentId, supabase });
  const { data, error } = await supabase
    .from("agent_messages")
    .insert({ thread_id: threadId, role, text, model_mode: modelMode })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function loadAgentHistory({ campaignId, workspace, agentId, supabase, limit = 12 }) {
  const { data: thread, error: threadError } = await supabase
    .from("agent_threads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("workspace", workspace)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (threadError) throw threadError;
  if (!thread) return [];
  const { data, error } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).reverse();
}

export async function persistRuntimeEvent({ event, supabase }) {
  const { error } = await supabase.from("runtime_events").insert({
    id: event.id,
    campaign_id: event.campaignId,
    workspace: event.workspace,
    type: event.type,
    actor: event.actor,
    payload: event.payload,
    created_at: event.timestamp,
  });
  if (error) throw error;
}

async function ensureThread({ campaignId, workspace, agentId, supabase }) {
  const { data: existing, error: selectError } = await supabase
    .from("agent_threads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("workspace", workspace)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("agent_threads")
    .insert({ campaign_id: campaignId, workspace, agent_id: agentId })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}
```

- [ ] **Step 3: Verify**

Run:

```powershell
npm test -- server/runtime-api.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Commit**

```powershell
git add server/agent-runtime.mjs server/runtime-api.test.mjs
git commit -m "feat: add durable agent message runtime"
```

---

### Task 7: Route `/api/orchestrator` Through Durable Runtime

**Files:**
- Modify: `server/panda-api.mjs`
- Modify: `server/panda-api.test.mjs`
- Modify: `server/agent-registry.mjs`

**Interfaces:**
- Consumes: `payload.campaign_id`, `payload.agent_scope`, `payload.question`
- Produces: `{ answer, highlights, suggested_actions, route, updates, snapshot, events, mode }`

- [ ] **Step 1: Add orchestrator runtime test**

In `server/panda-api.test.mjs`, add:

```js
it("keeps fixture orchestrator behavior when runtime mode is local", async () => {
  const req = createRequest("POST", {
    campaign_id: "camp_04",
    question: "update markets to China, Japan, Australia",
    agent_scope: { id: "campaign-planning-specialist", view: "campaign-planning" },
  });
  const res = createResponse();
  await handleOrchestrator(req, res);
  const body = JSON.parse(res.body);

  expect(body.answer).toBeTruthy();
  expect(body.mode).toBeTruthy();
});
```

- [ ] **Step 2: Extend specialist policy for plan-level updates**

In `server/agent-registry.mjs`, add `"update_campaign_plan"` to Campaign Planning allowed actions and update the JSON shape to include that action.

- [ ] **Step 3: Add runtime context path in `handleOrchestrator`**

In `server/panda-api.mjs`, import:

```js
import { createSupabaseServerClient, runtimeMode } from "./supabase-client.mjs";
import { executeRuntimeAction } from "./object-runtime.mjs";
```

After the AI result is normalized, execute updates when `runtimeMode() === "supabase"`:

```js
const supabase = createSupabaseServerClient();
const result = await callJsonAgent({ ... });
if (supabase && Array.isArray(result.updates)) {
  for (const update of result.updates) {
    await executeRuntimeAction({
      action: update,
      campaignId: payload.campaign_id || payload.campaignId || "camp_04",
      workspace: payload.agent_scope?.view || "home",
      actor: agent.id,
      supabase,
    });
  }
}
return sendJson(res, 200, result);
```

- [ ] **Step 4: Keep local mode stable**

Ensure `runtimeMode() === "local"` never requires Supabase env vars and returns the existing normalized packet.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- server/panda-api.test.mjs
npm test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add server/panda-api.mjs server/panda-api.test.mjs server/agent-registry.mjs
git commit -m "feat: route panda orchestrator through runtime"
```

---

### Task 8: Bind React UI to Runtime Snapshots

**Files:**
- Modify: `src/lib/panda.ts`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Modify: `src/lib/panda.test.ts`

**Interfaces:**
- Produces client helper: `normalizeCampaignSnapshot(raw): CampaignRuntimeSnapshot`
- Replaces direct canonical plan mutation with runtime snapshot refresh.

- [ ] **Step 1: Add client snapshot normalizer tests**

In `src/lib/panda.test.ts`, add:

```ts
it("normalizes durable campaign snapshots with visible plan markets", () => {
  const snapshot = normalizeCampaignSnapshot({
    campaign: { id: "camp_04", name: "Campaign", brief: "", phase: "planning", activeGate: "H1", ownerRole: "Campaign Owner" },
    plan: {
      campaignId: "camp_04",
      name: "Campaign",
      heroProduct: "TE2-22",
      markets: ["China", "Japan", "Australia"],
      locales: ["zh-CN", "ja-JP", "en-AU"],
      audience: ["Contractors"],
      budget: "EUR 50k",
      timeline: "Q4",
      channels: [],
      kpis: ["Net sales"],
      assumptions: [],
    },
    workObjects: [],
    contentRequirements: [],
    gateDecisions: [],
    events: [],
    agentThreads: [],
  });

  expect(snapshot.plan.markets).toEqual(["China", "Japan", "Australia"]);
});
```

- [ ] **Step 2: Add `CampaignRuntimeSnapshot` type and normalizer**

In `src/lib/panda.ts`, export:

```ts
export type CampaignRuntimeSnapshot = {
  campaign: {
    id: string;
    name: string;
    brief: string;
    phase: PhaseId | string;
    activeGate: string;
    ownerRole: UserRole | string;
  };
  plan: CampaignPlan;
  workObjects: PlanningWorkObject[];
  contentRequirements: ContentRequirement[];
  gateDecisions: GateDecision[];
  events: Array<{ id: string; type: string; workspace: string; actor: string; payload: Record<string, unknown>; createdAt?: string }>;
  agentThreads: unknown[];
};

export function normalizeCampaignSnapshot(raw: unknown): CampaignRuntimeSnapshot {
  const record = raw && typeof raw === "object" ? raw as Record<string, any> : {};
  return {
    campaign: record.campaign,
    plan: record.plan,
    workObjects: Array.isArray(record.workObjects) ? record.workObjects : [],
    contentRequirements: Array.isArray(record.contentRequirements) ? record.contentRequirements : [],
    gateDecisions: Array.isArray(record.gateDecisions) ? record.gateDecisions : [],
    events: Array.isArray(record.events) ? record.events : [],
    agentThreads: Array.isArray(record.agentThreads) ? record.agentThreads : [],
  };
}
```

- [ ] **Step 3: Add snapshot state in `src/main.tsx`**

Add:

```ts
const [runtimeSnapshots, setRuntimeSnapshots] = useState<Record<string, CampaignRuntimeSnapshot>>({});
const runtimeSnapshot = runtimeSnapshots[run.campaignId];
const campaignPlan = runtimeSnapshot?.plan ?? useMemo(() => campaignPlanForRun(run), [run]);
```

Refactor carefully because hooks cannot be conditional. Keep `generatedCampaignPlan` as a `useMemo`, then assign:

```ts
const generatedCampaignPlan = useMemo(() => campaignPlanForRun(run), [run]);
const campaignPlan = runtimeSnapshot?.plan ?? generatedCampaignPlan;
```

- [ ] **Step 4: Apply orchestrator returned snapshots**

In `askWorkspacePanda`, after parsing `packet`, add:

```ts
if (packet.snapshot) {
  const snapshot = normalizeCampaignSnapshot(packet.snapshot);
  setRuntimeSnapshots((current) => ({ ...current, [snapshot.campaign.id]: snapshot }));
}
```

- [ ] **Step 5: Add visible update marker**

In `CampaignPlanningWorkspace`, render below the plan header when events exist:

```tsx
{plan.markets.length > 0 && <span className="updatedByPanda">Updated by Panda runtime</span>}
```

Add CSS:

```css
.updatedByPanda {
  display: inline-flex;
  width: fit-content;
  border: 1px solid rgba(210, 5, 30, 0.28);
  color: #d2051e;
  background: rgba(210, 5, 30, 0.06);
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 800;
}
```

- [ ] **Step 6: Verify**

Run:

```powershell
npm test -- src/lib/panda.test.ts
npm run build
```

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add src/lib/panda.ts src/lib/panda.test.ts src/main.tsx src/styles.css
git commit -m "feat: bind panda ui to runtime snapshots"
```

---

### Task 9: Add Runtime Activity and Trace Panel

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`
- Modify: `src/lib/panda.ts`

**Interfaces:**
- Consumes: `runtimeSnapshot.events`
- Produces: visible trace on Progress and workspace pages.

- [ ] **Step 1: Add trace component**

In `src/main.tsx`, add:

```tsx
function RuntimeTracePanel({ events }: { events: CampaignRuntimeSnapshot["events"] }) {
  return (
    <section className="runtimeTracePanel">
      <div className="objectListHeader">
        <small>Runtime trace</small>
        <strong>Agent actions and audit trail</strong>
      </div>
      {events.length === 0 ? (
        <p>No durable runtime events yet.</p>
      ) : (
        events.slice(0, 12).map((event) => (
          <article key={event.id} className="traceEvent">
            <small>{event.workspace} · {event.type}</small>
            <strong>{event.actor}</strong>
            <p>{typeof event.payload?.note === "string" ? event.payload.note : JSON.stringify(event.payload).slice(0, 140)}</p>
          </article>
        ))
      )}
    </section>
  );
}
```

- [ ] **Step 2: Render trace on Campaign Planning**

In `CampaignPlanningWorkspace`, accept `events` prop and render:

```tsx
<RuntimeTracePanel events={events} />
```

- [ ] **Step 3: Style trace**

Add:

```css
.runtimeTracePanel {
  border: 1px solid var(--line);
  background: #fff;
  padding: 16px;
}

.traceEvent {
  border-top: 1px solid var(--line);
  padding: 10px 0;
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/main.tsx src/styles.css src/lib/panda.ts
git commit -m "feat: show panda runtime trace"
```

---

### Task 10: Configure Vercel Deployment for Durable Runtime

**Files:**
- Modify: `README.md`
- Create: `docs/deployment/vercel-durable-runtime.md`

**Interfaces:**
- Documents required Vercel env vars.
- Documents rollout mode: local first, Supabase preview second, production demo third.

- [ ] **Step 1: Create Vercel durable runtime guide**

Create `docs/deployment/vercel-durable-runtime.md`:

```md
# Vercel Durable Runtime Deployment

## Required Environment Variables

```powershell
PANDA_RUNTIME_MODE=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
PANDA_AI_TRANSPORT=vercel-ai
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_STYLE=openai
DEEPSEEK_TIMEOUT_MS=20000
```

## Rollout

1. Deploy with `PANDA_RUNTIME_MODE=local` and confirm current demo parity.
2. Run Supabase migration in the target Supabase project.
3. Seed `camp_04`.
4. Switch preview deployment to `PANDA_RUNTIME_MODE=supabase`.
5. Verify Home, Campaign Planning, Content Planning, Content, Rollout, Progress, and Runtime Trace.
6. Promote to production only after Vincent approves the preview.

## Safety

H3 remains the publish/spend authorization gate. Durable runtime stores planning and audit state only; it does not publish to live RMB tools.
```

- [ ] **Step 2: Link the guide from README**

Add:

```md
For Vercel + Supabase deployment, see `docs/deployment/vercel-durable-runtime.md`.
```

- [ ] **Step 3: Verify docs path**

Run:

```powershell
Test-Path docs/deployment/vercel-durable-runtime.md
```

Expected: `True`.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/deployment/vercel-durable-runtime.md
git commit -m "docs: add durable runtime deployment guide"
```

---

## Execution Order

1. Task 1 creates the durable schema.
2. Task 2 adds safe runtime mode boundaries.
3. Task 3 adds canonical campaign snapshots.
4. Task 4 adds validated action execution and revisions.
5. Task 5 adds Vercel AI SDK transport.
6. Task 6 persists agent conversation and events.
7. Task 7 routes `/api/orchestrator` through the runtime.
8. Task 8 binds the UI to canonical snapshots.
9. Task 9 exposes trace visibility.
10. Task 10 documents Vercel rollout.

## Definition of Done

- `PANDA_RUNTIME_MODE=local` preserves the current demo.
- `PANDA_RUNTIME_MODE=supabase` stores campaign state in Supabase.
- Campaign Planning agent can update markets/locales/KPIs and the visible plan packet changes immediately.
- Agent answer, visible workspace, object revision, and runtime trace agree.
- Workspace agent chat histories remain isolated by campaign and workspace.
- Vercel AI SDK transport works with DeepSeek through OpenAI-compatible config.
- `npm test` and `npm run build` pass.
- No GitHub push or Vercel production promotion occurs without Vincent approval.
