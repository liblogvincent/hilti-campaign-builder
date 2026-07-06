# Panda (Prototype 4)

Panda is the v4 Agentic E2E prototype: an RMB-informed control tower for campaign planning, rollout readiness, and optimization.

## What Panda Demonstrates

- `camp_04` is treated as an existing seeded campaign, not the only possible run.
- New campaigns can be created from a fresh human brief.
- The homepage works as a Campaign Control Tower.
- Panda shows RMB ask-vs-delivery coverage by gate, workstream, owner, and tool.
- Panda shows the current RMB toolchain and responsibility map.
- Run real DeepSeek-backed agent phases with fixture fallback.
- Produce gate-ready artifacts for:
  - `H1` Plan
  - `H2` Content + QA
  - `H3` Rollout & Publish Readiness
  - `H4` Performance Insights & Optimization
- Preserve artifacts, worklog, and gate decisions in local storage.
- Download a run record JSON for trace review.
- Generate deterministic H3 rollout evidence through local integration-style endpoints.

## Boundary

Panda is now an RMB-informed control tower prototype. It can run a real DeepSeek-backed agent loop and produce inspectable evidence, but most external tools remain mock/file/MCP/API posture labels. It does not publish, spend money, or claim complete RMB campaign coverage. H3 remains the only publish authorization, and all live connector writes require production credentials, Astra gates, and RMB approval.

## Run

```powershell
npm install
npm run dev
```

Open the URL printed by Vite. The local API is started automatically on port `8787`.

## Vercel Preview

Panda is deployable as a Vite app with Vercel serverless API routes under `api/`.

Use these settings:

- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- API routes: `/api/health`, `/api/agent`, `/api/orchestrator`, `/api/integrations/status`, `/api/integrations/package`

Set these Vercel environment variables for a live agent demo:

```powershell
DEEPSEEK_API_KEY=
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_API_STYLE=openai
DEEPSEEK_TIMEOUT_MS=20000
```

Without `DEEPSEEK_API_KEY`, Panda still runs in deterministic fixture mode.

## DeepSeek

Copy `.env.example` to `.env` and set:

```powershell
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_API_STYLE=openai
```

Without a key, Panda stays fully usable with deterministic demo output.

For Anthropic-compatible gateways, use:

```powershell
DEEPSEEK_BASE_URL=https://api.deepseek.com/anthropic
DEEPSEEK_API_STYLE=anthropic
```

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

For Vercel + Supabase deployment, see [docs/deployment/vercel-durable-runtime.md](docs/deployment/vercel-durable-runtime.md).
