# Panda Orchestrator + Specialist Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Panda behave as a global Home orchestrator plus scoped workspace specialist agents that revise their own work objects while sharing campaign context and conversation history.

**Architecture:** Keep the prototype local-state first. Add typed intent classification, specialist response contracts, object update helpers, and shared campaign conversation rendering. Home Panda becomes an orchestrator surface; workspace agents apply scoped updates and do not leak unrelated gate/blocker logic.

**Tech Stack:** React + TypeScript + Vite, localStorage persistence, Vitest, existing `/api/orchestrator` DeepSeek fallback.

## Global Constraints

- Do not push to GitHub until all four phases are complete and verified.
- Do not introduce Supabase or a database in this pass.
- Keep Home Panda as the global orchestrator; do not auto-route for simple text.
- Keep each workspace specialist scoped to its own editable objects.
- Preserve shared campaign context across Home and workspace chat surfaces.
- Use TDD for new logic.

---

### Task 1: Orchestrator Intent and Home Routing

**Files:**
- Modify: `src/lib/panda.ts`
- Modify: `src/lib/panda.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `classifyHomeIntent(input: string): HomeIntent`
- Produces: `homeOrchestratorDraft(input: string, campaignName: string): string`
- Consumes: existing `createCampaignFromBrief`, `buildAgentScope`, `pandaContextFor`

- [ ] Add failing tests for casual question, campaign creation, campaign update, and route request.
- [ ] Implement `HomeIntent` and `classifyHomeIntent`.
- [ ] Change Home submit so only create-campaign intent creates a campaign.
- [ ] Keep Home on Home after creation and avoid automatic navigation.

### Task 2: Shared Campaign Conversation History

**Files:**
- Modify: `src/lib/panda.ts`
- Modify: `src/lib/panda.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `campaignConversationKey(campaignId: string): string`
- Produces: `visibleWorkspaceMessages(shared: AgentMessage[], local: AgentMessage[]): AgentMessage[]`
- Consumes: existing `workspaceAgentMessageKey`

- [ ] Add failing tests proving Campaign Planning sees the creation brief and Home Panda orchestration message.
- [ ] Store home campaign-related messages under a shared campaign key.
- [ ] Render shared campaign messages before workspace-specific messages in workspace agent panels.

### Task 3: Specialist Agent Update Contracts

**Files:**
- Modify: `src/lib/panda.ts`
- Modify: `src/lib/panda.test.ts`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `SpecialistAgentResponse`
- Produces: `draftSpecialistAgentResponse(view: AppView, question: string, context: PandaContextPacket): SpecialistAgentResponse`
- Produces: `applyPlanningInstruction(objects: PlanningWorkObject[], instruction: string): PlanningWorkObject[]`
- Consumes: existing `applyContentPlanningInstruction`, `createContentWorkObjectsFromRequirements`

- [ ] Add failing tests for Campaign Planning update language modifying H1 objects without approval.
- [ ] Add failing tests for Content Planning update language modifying CP/requirements behavior.
- [ ] Implement scoped specialist draft responses with `updates`.
- [ ] Apply Campaign Planning updates to planning objects and audit the change.

### Task 4: Fallback Orchestrator Scope Guard

**Files:**
- Modify: `server/panda-packets.mjs`
- Modify: `server/panda-packets.test.mjs`

**Interfaces:**
- Produces: view-aware fallback answer for `agent_scope.name === "Campaign Planning Panda"`
- Consumes: existing `buildOrchestratorAnswer(payload)`

- [ ] Add failing test proving Campaign Planning questions do not return rollout/H3 blocker summaries.
- [ ] Update fallback answer to use planning objects for planning scope and rollout blockers only for rollout/global blocker questions.

### Task 5: Verification

**Files:**
- No source changes unless tests reveal defects.

- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Browser smoke: Home simple message stays Home; create campaign creates campaign but does not auto-navigate; Campaign Planning chat shows creation history; planning update changes a planning object; Campaign Planning answer does not mention rollout blockers for plan-edit prompt.
