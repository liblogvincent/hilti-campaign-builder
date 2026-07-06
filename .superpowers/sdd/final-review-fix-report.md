# Durable Panda Runtime Final Review Fix Report

## Files Changed

- `package.json`
- `api/gate-decision.js`
- `server/object-runtime.mjs`
- `server/panda-api.mjs`
- `server/panda-api.test.mjs`
- `server/runtime-api.test.mjs`
- `src/lib/panda.test.ts`
- `src/lib/panda.ts`
- `src/main.tsx`
- `supabase/migrations/202607060001_durable_panda_runtime.sql`

## Fixes Mapped To Findings

1. RPC exposure hardening
   - Hardened `public.persist_agent_turn` with an explicit `search_path`, service-role guard, execute revokes for `public` / `anon` / `authenticated`, service-role-only grant, and explicit ownership assignment.

2. Missing `campaign_plans` bootstrap on fresh Supabase setup
   - Seeded the initial `camp_04` plan row in the migration.
   - Added a runtime insert fallback so `update_campaign_plan` creates version `1` from campaign/runtime data when no plan row exists yet.
   - Added runtime tests for the missing-plan insert path.

3. Durable gate decision persistence
   - Added a dedicated `/api/gate-decision` runtime route and server handler.
   - Implemented `create_gate_decision` runtime execution for durable `gate_decisions`, `runtime_events`, and campaign phase/gate advancement in Supabase mode.
   - Updated `src/main.tsx` gate approve/revise flows to persist through the runtime API before applying local state.
   - Kept local fixture mode working by falling back to local state updates when the runtime stays in local mode.

4. Object-aware gate approval readiness
   - Added shared `gateApprovalReadiness(...)` logic in `src/lib/panda.ts`.
   - Disabled gate approval until the active phase objects are fully ready.
   - Added tests covering H2 readiness roll-up behavior.

Minor
- Added `engines.node: ">=22"` to `package.json`.

## Tests Run

- `npm test -- server/runtime-api.test.mjs` — PASS
- `npm test -- server/panda-api.test.mjs` — PASS
- `npm test -- src/lib/panda.test.ts` — PASS
- `npm test` — PASS
- `npm run build` — PASS
- `git diff --check 82a87a6..HEAD` — FAIL (pre-existing EOF whitespace issues outside this patch; left unchanged to avoid broad churn)

## Commit Hash

- `58eafa0`

## Self-Review

- Kept the patch on the existing runtime action/server API shape instead of adding a parallel persistence model.
- Preserved local fixture behavior while making Supabase mode authoritative for gate decisions.
- Added focused regression coverage for the new durable paths and the object-aware gate rule.

## Concerns

- `git diff --check 82a87a6..HEAD` reports older whitespace-only EOF issues in files outside this patch:
  - `.superpowers/sdd/task-1-report.md`
  - `.superpowers/sdd/task-2-report.md`
  - `.superpowers/sdd/task-3-report.md`
  - `.superpowers/sdd/task-5-report.md`
  - `.superpowers/sdd/task-6-report.md`
  - `docs/superpowers/plans/2026-07-06-durable-panda-runtime.md`

## Final Review Atomic Gate Decision Fix Addendum

- Files changed: `server/object-runtime.mjs`, `server/runtime-api.test.mjs`, `server/panda-api.test.mjs`, `supabase/migrations/202607060001_durable_panda_runtime.sql`, `.superpowers/sdd/final-review-fix-report.md`
- Fix: moved Supabase gate decision persistence into service-role-only `public.persist_gate_decision(...)` RPC so gate decision insert, campaign phase advancement, and runtime event write happen in one database transaction. The RPC locks the campaign row and advances only when the campaign is still on the approved gate, preventing retry double-advance.
- Tests run: `npm test -- server/runtime-api.test.mjs` - PASS; `npm test -- server/panda-api.test.mjs` - PASS; `npm test` - PASS (150 tests); `npm run build` - PASS
- Commit hash: pending
- Concerns: no live Supabase migration smoke test was run in this environment.
