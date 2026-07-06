# Panda Runtime + AI Transport Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Panda from a UI-heavy prototype into a clearer Orchestrator + specialist-agent prototype where Home Panda gathers and routes campaign intent, workspace agents update their own work objects, and all agents share one campaign context without leaking each other's chat history.

**Architecture:** Keep Panda's product-specific orchestration custom: H1-H4 gates, RMB/RMN work objects, handoffs, audit, and human approvals remain Panda domain logic. Add an AI transport boundary so DeepSeek, OpenAI-compatible models, Vercel AI SDK, or future Claude/Gemini providers can be swapped without rewriting campaign workflows. Use localStorage and current serverless endpoints for this prototype, but design interfaces so Supabase/Postgres and durable job queues can replace them later.

**Tech Stack:** React 18 + TypeScript + Vite, Vitest, Node/Vercel serverless functions, current DeepSeek-compatible API, optional future Vercel AI SDK transport.

## Global Constraints

- Do not push to GitHub or Vercel until Vincent explicitly approves.
- Do not expose API keys, tokens, or contents of `C:\Users\tutuclaw\Documents\APIs, log-ins and other information.md`.
- Keep DeepSeek as a supported provider.
- Home Panda is the global orchestrator. Workspace agents are specialists.
- Workspace agents must not inherit another workspace's visible conversation.
- Shared campaign context is allowed; shared rendered chat history is not.
- No auto-publish. H3 remains the human publish/spend authorization gate.
- Gate approval remains object-aware: object-level approvals roll up to final gate readiness.
- Use the verified Claude Code WSL harness only with the NVM binary:
  `wsl -e bash -lc 'cd /mnt/c/Users/tutuclaw/Documents/hilti-campaign-builder && "$HOME/.nvm/versions/node/v24.15.0/bin/claude" -p "<bounded prompt>" --output-format text --no-session-persistence'`
- Never use the fallback WSL `claude` on PATH, because it resolves to `/mnt/c/Users/tutuclaw/AppData/Roaming/npm/claude` v2.1.177 and uses the wrong limited API account.

---

## File Structure

- Modify: `src/lib/panda.ts`
  - Owns campaign domain types, intent classification, agent scope definitions, context packet construction, object mutation helpers, and fixture responses.
- Modify: `src/main.tsx`
  - Owns UI state, Home orchestrator composer, workspace specialist panels, object updates, and route behavior.
- Modify: `server/panda-api.mjs`
  - Owns API request handlers, provider calls, response normalization, and fixture fallback.
- Create: `server/ai-transport.mjs`
  - Provider-neutral request wrapper for JSON agent calls.
- Create: `server/agent-registry.mjs`
  - Server-side registry for Home orchestrator and specialist prompts, allowed actions, and schema names.
- Create: `server/runtime-events.mjs`
  - Prototype event envelope helpers for agent messages, object patches, gate actions, and audit trail entries.
- Modify: `server/panda-api.test.mjs`
  - Add transport, registry, normalization, and update-contract tests.
- Modify: `src/lib/panda.test.ts`
  - Add tests for Home intent discovery, specialist chat isolation, context packet shape, and workspace instruction mutations.
- Optional later: `api/orchestrator-stream.js`
  - Only if streaming is introduced in this iteration.

---

### Task 1: Lock the Claude Code Worker Harness

**Files:**
- Create: `docs/superpowers/claude-code-harness.md`

**Interfaces:**
- Consumes: Verified WSL path `/home/tutulux/.nvm/versions/node/v24.15.0/bin/claude`
- Produces: A documented command template for bounded Claude Code tasks

- [ ] **Step 1: Record the verified command**

Create `docs/superpowers/claude-code-harness.md` with:

````md
# Claude Code WSL Harness

Use this command from PowerShell/Codex when Claude Code is needed as a bounded implementation worker:

```powershell
wsl -e bash -lc 'cd /mnt/c/Users/tutuclaw/Documents/hilti-campaign-builder && "$HOME/.nvm/versions/node/v24.15.0/bin/claude" -p "<TASK PROMPT>" --output-format text --no-session-persistence'
```

Do not call plain `claude` from non-interactive WSL. It resolves to the Windows npm shim and may use the wrong API account.

Worker rules:
- One task per prompt.
- Name exact files the worker may inspect or edit.
- Do not include secrets.
- Ask Claude to stop after the patch summary.
- Codex reviews `git diff`, runs tests, and decides whether to keep or revise the work.
````

- [ ] **Step 2: Verify the harness still works**

Run:

```powershell
wsl -e bash -lc 'cd /mnt/c/Users/tutuclaw/Documents/hilti-campaign-builder && "$HOME/.nvm/versions/node/v24.15.0/bin/claude" -p "Reply with exactly: CLAUDE_WSL_NVM_OK" --output-format text --no-session-persistence'
```

Expected:

```text
CLAUDE_WSL_NVM_OK
```

- [ ] **Step 3: Commit the harness doc**

Run:

```powershell
git add docs/superpowers/claude-code-harness.md
git commit -m "docs: add claude code wsl harness"
```

---

### Task 2: Add Provider-Neutral AI Transport

**Files:**
- Create: `server/ai-transport.mjs`
- Modify: `server/panda-api.mjs`
- Modify: `server/panda-api.test.mjs`

**Interfaces:**
- Consumes: `{ provider, payload, systemPrompt, fallback, normalize }`
- Produces: `callJsonAgent({ provider, payload, systemPrompt, fallback, normalize }): Promise<object>`

- [ ] **Step 1: Add failing transport tests**

Add tests in `server/panda-api.test.mjs` that verify:

```js
import { describe, expect, it } from "vitest";
import { resolveProviderConfig, parseJsonObject } from "./ai-transport.mjs";

describe("ai transport", () => {
  it("uses fixture mode when no provider key is available", () => {
    const config = resolveProviderConfig({});
    expect(config.mode).toBe("fixture");
  });

  it("extracts JSON from a model response with surrounding text", () => {
    expect(parseJsonObject("Here is JSON {\"answer\":\"ok\"}", { answer: "fallback" })).toEqual({ answer: "ok" });
  });

  it("falls back safely when JSON is malformed", () => {
    expect(parseJsonObject("not json", { answer: "fallback" })).toEqual({ answer: "fallback" });
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```powershell
npm test -- server/panda-api.test.mjs
```

Expected before implementation: FAIL because `server/ai-transport.mjs` does not exist.

- [ ] **Step 3: Implement `server/ai-transport.mjs`**

Create the module with these exports:

```js
export function resolveProviderConfig(env = process.env) {
  if (env.DEEPSEEK_API_KEY) {
    return {
      mode: "deepseek",
      style: env.DEEPSEEK_API_STYLE || "openai",
      baseUrl: env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
      model: env.DEEPSEEK_MODEL || "deepseek-chat",
      timeoutMs: Number(env.DEEPSEEK_TIMEOUT_MS || 20000),
      apiKey: env.DEEPSEEK_API_KEY,
    };
  }
  return { mode: "fixture" };
}

export function parseJsonObject(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export async function callJsonAgent({ payload, systemPrompt, fallback, normalize, env = process.env, fetchImpl = fetch }) {
  const config = resolveProviderConfig(env);
  if (config.mode === "fixture") return { mode: "fixture", ...fallback };

  const result = config.style === "anthropic"
    ? await callAnthropicStyle({ config, payload, systemPrompt, fallback, fetchImpl })
    : await callOpenAiStyle({ config, payload, systemPrompt, fallback, fetchImpl });

  if (!result.ok) return { mode: "fixture", warning: result.warning, ...fallback };
  return normalize(parseJsonObject(result.text, fallback), payload, config.mode);
}
```

Move the existing OpenAI-style and Anthropic-style fetch logic from `server/panda-api.mjs` into private helpers inside `server/ai-transport.mjs`.

- [ ] **Step 4: Refactor `server/panda-api.mjs`**

Replace `callOpenAiStyle`, `callAnthropicStyle`, and local `parseJsonObject` with `callJsonAgent`. Keep `normalizeResponse` and `normalizeOrchestratorResponse` in `server/panda-api.mjs`.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- server/panda-api.test.mjs
npm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add server/ai-transport.mjs server/panda-api.mjs server/panda-api.test.mjs
git commit -m "refactor: isolate panda ai transport"
```

---

### Task 3: Move Agent Roles Into a Server Registry

**Files:**
- Create: `server/agent-registry.mjs`
- Modify: `server/panda-api.mjs`
- Modify: `server/panda-api.test.mjs`
- Modify: `src/lib/panda.ts`

**Interfaces:**
- Produces: `getAgentDefinition(scope): { id, label, systemPrompt, allowedActions, schemaName }`
- Consumes: `agent_scope` from the client

- [ ] **Step 1: Add registry tests**

Add tests:

```js
import { getAgentDefinition } from "./agent-registry.mjs";

describe("agent registry", () => {
  it("routes home to the orchestrator definition", () => {
    const agent = getAgentDefinition({ id: "home-orchestrator", view: "home" });
    expect(agent.id).toBe("home-orchestrator");
    expect(agent.allowedActions).toContain("ask_brief_question");
  });

  it("routes content planning to its specialist definition", () => {
    const agent = getAgentDefinition({ id: "content-planning-specialist", view: "content-planning" });
    expect(agent.id).toBe("content-planning-specialist");
    expect(agent.allowedActions).toContain("update_content_requirements");
  });
});
```

- [ ] **Step 2: Implement the registry**

Create `server/agent-registry.mjs` with definitions for:

```js
const AGENTS = {
  "home-orchestrator": {
    id: "home-orchestrator",
    label: "Home Panda Orchestrator",
    schemaName: "orchestrator.answer.v1",
    allowedActions: ["ask_brief_question", "create_campaign_when_ready", "route_to_workspace", "explain_status"],
  },
  "campaign-planning-specialist": {
    id: "campaign-planning-specialist",
    label: "Campaign Planning Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["update_planning_object", "summarize_h1_plan", "apply_leadership_feedback", "find_h1_gaps"],
  },
  "content-planning-specialist": {
    id: "content-planning-specialist",
    label: "Content Planning Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["update_content_requirements", "check_figma_mapping", "find_locale_gaps", "summarize_h2_inputs"],
  },
  "content-specialist": {
    id: "content-specialist",
    label: "Content Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["revise_content_object", "comment_on_object", "prepare_h2_evidence"],
  },
  "rollout-specialist": {
    id: "rollout-specialist",
    label: "Rollout Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["update_rollout_lane", "find_connector_gaps", "prepare_h3_evidence"],
  },
  "optimize-specialist": {
    id: "optimize-specialist",
    label: "Optimize Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["summarize_performance", "recommend_optimization", "promote_learning_candidate"],
  },
};
```

Each definition must build a system prompt that states the agent's role, allowed actions, forbidden actions, and required JSON response shape.

- [ ] **Step 3: Use the registry in `/api/orchestrator`**

In `handleOrchestrator`, resolve:

```js
const agent = getAgentDefinition(payload.agent_scope);
```

Then pass `agent.systemPrompt` to `callJsonAgent`.

- [ ] **Step 4: Keep client scope names aligned**

In `src/lib/panda.ts`, verify `buildAgentScope(view)` returns IDs matching the registry:

```ts
home -> home-orchestrator
campaign-planning -> campaign-planning-specialist
content-planning -> content-planning-specialist
content -> content-specialist
rollout -> rollout-specialist
optimize -> optimize-specialist
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm test
npm run build
```

Expected: tests and build pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add server/agent-registry.mjs server/panda-api.mjs server/panda-api.test.mjs src/lib/panda.ts
git commit -m "feat: add panda agent registry"
```

---

### Task 4: Fix Home Orchestrator Discovery Before Campaign Creation

**Files:**
- Modify: `src/lib/panda.ts`
- Modify: `src/lib/panda.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: Home prompt text
- Produces: one of `ask_more`, `update_existing_campaign`, `create_campaign_ready`, `route`

- [ ] **Step 1: Add tests for campaign creation threshold**

Add tests in `src/lib/panda.test.ts`:

```ts
it("does not create a campaign from a shallow product mention", () => {
  expect(classifyHomeIntent("TE70")).toEqual({ type: "plan-campaign" });
  expect(classifyHomeIntent("launch a campaign of TE70").type).toBe("plan-campaign");
});

it("creates a campaign only when the user gives a launch action and enough brief detail", () => {
  expect(classifyHomeIntent("create campaign for TE70 in DACH for installers with paid media and email").type).toBe("create-campaign");
});
```

- [ ] **Step 2: Update `classifyHomeIntent`**

Require at least two brief signals before returning `create-campaign`:

```ts
const hasProduct = /\b(te|siw|nur|bx|ag|pd|laser|drill|anchor|tool)\w*/i.test(prompt);
const hasAudience = /\b(contractor|installer|specifier|mocn|audience|segment|persona)\b/i.test(prompt);
const hasMarket = /\b(dach|germany|austria|switzerland|de|at|ch|eu|market|region)\b/i.test(prompt);
const hasChannel = /\b(email|paid|social|sprinklr|contentful|hol|linkedin|google|meta)\b/i.test(prompt);
const hasBudgetOrTiming = /\b(budget|eur|euro|q[1-4]|launch|timeline|date|week|month)\b/i.test(prompt);
const signalCount = [hasProduct, hasAudience, hasMarket, hasChannel, hasBudgetOrTiming].filter(Boolean).length;
```

Return `create-campaign` only when the user uses a creation verb and `signalCount >= 3`.

- [ ] **Step 3: Update `buildHomeCampaignDiscoveryReply`**

Make the reply ask for missing campaign planning inputs:

```ts
"I can help shape this into a campaign brief. I still need: audience/persona, target market or locale, channel mix, KPI, budget or timing. Tell me those, or say 'create it' once the brief is ready."
```

- [ ] **Step 4: Update `submitHomePrompt`**

When intent is `plan-campaign`, append the user's message and Panda's discovery reply to Home/global messages only. Do not navigate and do not create a campaign.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/lib/panda.test.ts
npm run build
```

Expected: tests and build pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/lib/panda.ts src/lib/panda.test.ts src/main.tsx
git commit -m "fix: make home panda gather brief before campaign creation"
```

---

### Task 5: Separate Shared Context From Specialist Chat History

**Files:**
- Modify: `src/lib/panda.ts`
- Modify: `src/lib/panda.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Consumes: campaign ID, current view, local workspace messages, shared campaign context
- Produces: isolated visible chat plus shared context packet

- [ ] **Step 1: Add isolation tests**

Add tests:

```ts
it("uses distinct message keys per campaign and workspace", () => {
  expect(workspaceAgentMessageKey("camp-1", "content-planning")).not.toBe(workspaceAgentMessageKey("camp-1", "content"));
  expect(workspaceAgentMessageKey("camp-1", "content")).not.toBe(workspaceAgentMessageKey("camp-2", "content"));
});

it("keeps visible specialist messages local to the specialist", () => {
  const shared = [{ id: "s", role: "user" as const, text: "global", timestamp: "now" }];
  const local = [{ id: "l", role: "agent" as const, text: "local", timestamp: "now" }];
  expect(visibleWorkspaceMessages(shared, local).map((m) => m.text)).toEqual(["local"]);
});
```

- [ ] **Step 2: Confirm context still shares campaign state**

Add a test for `buildPandaContextPacket` asserting the packet includes campaign summary, phase, planning objects, content requirements, and object counts, but not another workspace's rendered messages.

- [ ] **Step 3: Update `AgentPanel` inputs**

In `src/main.tsx`, ensure each workspace passes:

```ts
const key = workspaceAgentMessageKey(run.campaignId, view);
const visibleMessages = workspaceAgentMessages[key] ?? [];
```

Do not merge global/home chat into `messages`.

- [ ] **Step 4: Update request payload**

When calling `/api/orchestrator`, include only compact local history:

```ts
conversation_history: compactAgentMessages(workspaceAgentMessages[key] ?? []).slice(-6)
```

Also include shared work-object context through `buildPandaContextPacket`.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/lib/panda.test.ts
npm run build
```

Expected: specialist panels no longer show Home or other specialist history, while server still receives shared campaign context.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/lib/panda.ts src/lib/panda.test.ts src/main.tsx
git commit -m "fix: isolate specialist chat while sharing campaign context"
```

---

### Task 6: Make Specialist Agents Return Structured Workspace Updates

**Files:**
- Modify: `src/lib/panda.ts`
- Modify: `src/lib/panda.test.ts`
- Modify: `src/main.tsx`
- Modify: `server/agent-registry.mjs`
- Modify: `server/panda-api.mjs`

**Interfaces:**
- Produces server response field:

```ts
updates?: Array<{
  action: "update_planning_object" | "update_content_requirements" | "update_content_object" | "update_rollout_lane";
  targetId?: string;
  status?: WorkObjectStatus;
  note: string;
  payload?: Record<string, unknown>;
}>
```

- [ ] **Step 1: Add normalizer tests**

In `server/panda-api.test.mjs`, verify malformed updates are removed and valid updates are preserved:

```js
it("normalizes specialist updates", () => {
  const normalized = normalizeOrchestratorResponse({
    answer: "Updated.",
    updates: [{ action: "update_content_requirements", note: "Add MOCN-only content.", payload: { audience: "MOCN" } }],
  }, { question: "add MOCN" }, "deepseek");
  expect(normalized.updates).toHaveLength(1);
});
```

- [ ] **Step 2: Extend specialist prompt shape**

In `server/agent-registry.mjs`, require workspace agents to return:

```json
{"answer":"string","highlights":["string"],"suggested_actions":["string"],"route":"string","updates":[{"action":"string","note":"string","targetId":"string","status":"string","payload":{}}]}
```

Home orchestrator may return `updates`, but should usually ask brief questions until campaign creation is ready.

- [ ] **Step 3: Normalize updates server-side**

In `normalizeOrchestratorResponse`, add `updates` validation with an allowlist of actions. Limit to 8 updates per response.

- [ ] **Step 4: Apply updates client-side**

In `askWorkspacePanda`, after receiving `packet`, apply supported updates:

```ts
if (targetView === "content-planning") {
  const requirementUpdate = packet.updates?.find((update) => update.action === "update_content_requirements");
  if (requirementUpdate) applyContentPlanningInstructionToWorkspace(requirementUpdate.note);
}
```

Keep current deterministic helper functions as the prototype patch executor.

- [ ] **Step 5: Verify the MOCN scenario**

Manual browser test:

1. Open `http://127.0.0.1:5174/content-planning`.
2. Type `please add the content for MOCN audience only`.
3. Expected: Panda replies in the Content Planning agent panel.
4. Expected: the right-side content planning matrix adds or highlights MOCN audience requirements.
5. Expected: no navigation to Home.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/lib/panda.ts src/lib/panda.test.ts src/main.tsx server/agent-registry.mjs server/panda-api.mjs server/panda-api.test.mjs
git commit -m "feat: apply specialist agent workspace updates"
```

---

### Task 7: Polish Agent Panel UI After Behavior Is Correct

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: current `AgentPanel` props
- Produces: clearer specialist panel with upload, skills, model placeholder, and send always visible

- [ ] **Step 1: Remove duplicated controls**

In `AgentPanel`, keep:

- `+` as upload file.
- Sparkle icon as skills/evidence helper.
- `DS` compact model selector.
- `Send` button.

Remove Plan/Build mode buttons from workspace agent panels.

- [ ] **Step 2: Fix composer layout**

In `src/styles.css`, ensure `.composerToolbar` uses a fixed grid:

```css
.composerToolbar {
  display: grid;
  grid-template-columns: auto auto 72px minmax(92px, 1fr);
  gap: 8px;
  align-items: center;
}
```

Ensure `.sendRound` has `min-width: 92px` and never overflows the panel.

- [ ] **Step 3: Make messages readable**

Ensure `.compactMessages` has a fixed max height, scrolls internally, and user messages do not overflow the chatbox.

- [ ] **Step 4: Verify in browser**

Run:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5174/
http://127.0.0.1:5174/content-planning
http://127.0.0.1:5174/content
```

Expected: Send button visible, no message overflow, no duplicated Plan/Build controls.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/main.tsx src/styles.css
git commit -m "style: polish panda specialist agent panel"
```

---

## Claude Code Execution Pattern

Claude Code is a good worker plan if Codex remains the controller and reviewer.

Recommended loop:

1. Codex prepares a bounded task prompt from one task above.
2. Codex runs the verified WSL NVM command.
3. Claude Code edits only the files named in the task prompt.
4. Codex reviews `git diff`.
5. Codex runs the task tests and browser checks.
6. Codex either commits or asks Claude/Codex to revise.

Do not ask Claude Code to do architecture decisions, secrets handling, deployment, or final approval. Those remain Codex + Vincent decisions.

## Execution Recommendation

Start with Task 1 and Task 2. They reduce risk without changing user-visible UX. Then do Task 4 and Task 5 before Task 6, because campaign creation threshold and chat isolation must be correct before structured workspace updates matter.

Plan complete. Recommended execution mode: **Codex-controlled Claude worker for one task at a time**, with Codex review and tests between tasks.
