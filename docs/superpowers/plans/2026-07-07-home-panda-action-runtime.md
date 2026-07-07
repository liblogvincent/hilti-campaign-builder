# Home Panda Action Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Home Panda behave as the campaign-building agent entry point, with draft-scoped conversation, visible editable campaign draft, and explicit create/revise actions.

**Architecture:** Replace Home's UI-led intent branching with a small Panda turn contract: user message + active draft + researched evidence in, natural answer + draft patch + suggested actions out. React renders the active draft as a work canvas and only creates a campaign when the user explicitly asks to create from the reviewed draft.

**Tech Stack:** Vite, React, TypeScript, Vitest, Node API server, DeepSeek through the existing AI transport.

## Global Constraints

- Home Panda must not use user-facing gate jargon (`H1`, `blocked`, `Risk lane`, `approval`) while shaping a brief.
- Home Panda must answer follow-up questions from the active Home draft before falling back to current campaign workflow status.
- Campaign creation must be explicit after a reviewable draft exists.
- The first slice is Home only; Campaign Planning and Content Planning will be rebuilt after this is stable.

---

### Task 1: Add Home Panda Turn Contract

**Files:**
- Modify: `server/panda-api.mjs`
- Test: `server/panda-api.test.mjs`

**Interfaces:**
- Consumes: `{ question: string, conversation: HomeTurnMessage[], activeDraft?: HomeCampaignDraft, researchEvidence?: ResearchEvidence[] }`
- Produces: `{ mode, answer, draft, draftPatch, suggested_actions, intent }`

- [ ] **Step 1: Write failing tests**

Add tests that:
- `normalizeHomeTurnResponse()` answers “where are the assumptions?” from `activeDraft`.
- The answer does not contain `blocked`, `Risk lane`, `approval`, or `H1`.
- `/api/home-turn` calls the AI transport and normalizes the response.

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- server/panda-api.test.mjs`

- [ ] **Step 3: Implement the minimal server contract**

Add:
- `homeTurnPrompt`
- `handleHomeTurn`
- `normalizeHomeTurnResponse`
- draft-aware fallback helpers
- route registration for `/api/home-turn`

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- server/panda-api.test.mjs`

### Task 2: Add Home Draft State Utilities

**Files:**
- Modify: `src/lib/panda.ts`
- Test: `src/lib/panda.test.ts`

**Interfaces:**
- Produces: `mergeHomeDraft(base, patch)`, `homeDraftSummarySections(draft)`, `homeDraftQuestionAnswer(question, draft)`

- [ ] **Step 1: Write failing tests**

Add tests that:
- merge a partial draft patch without dropping existing fields
- answer assumptions/missing-inputs questions naturally from a draft
- avoid gate/blocker words in draft answers

- [ ] **Step 2: Verify tests fail**

Run: `npm test -- src/lib/panda.test.ts`

- [ ] **Step 3: Implement utilities**

Add focused helper functions in `src/lib/panda.ts` near the Home draft types.

- [ ] **Step 4: Verify tests pass**

Run: `npm test -- src/lib/panda.test.ts`

### Task 3: Wire Home UI To Panda Turn

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `/api/home-turn`
- Produces: active Home draft canvas and natural Home transcript behavior

- [ ] **Step 1: Update Home state**

Keep `activeHomeDraft` in `App`, update it from each Panda turn, and pass it into `HomeLauncher`.

- [ ] **Step 2: Replace Home continuation routing**

Stop routing ordinary follow-ups like “where are assumptions?” or “tell me what is missing” into Campaign Planning. Send them to `/api/home-turn` with the active draft.

- [ ] **Step 3: Add visible Home draft canvas**

Render sections for product, objective, audience, markets, channels, KPI candidates, budget/timing assumptions, missing decisions, and source evidence.

- [ ] **Step 4: Clean the composer**

Remove `Brief + Q&A`; keep `Plan` / `Create` only as action intent controls or replace them with explicit draft action buttons. Keep the Send button visible and right-aligned.

### Task 4: Verification

**Files:**
- Test only

- [ ] Run `npm test`
- [ ] Run `npm run build`
- [ ] Use Playwright against `http://127.0.0.1:5174/`
- [ ] Test diamond coring conversation:
  1. “i want to build a campaign about diamond coring products of Hilti.”
  2. “where is the assumption?”
  3. “tell me what are missing inputs”
  4. “create campaign workspace”
- [ ] Confirm Panda drafts before create, answers naturally, avoids blocker/gate jargon, and creates only after explicit create.

