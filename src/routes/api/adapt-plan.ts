import { createFileRoute } from "@tanstack/react-router";
import { createAiGatewayProvider, resolveGatewayConfig, tryWithModelFallback } from "@/lib/ai-gateway.server";
import { callAgentWithRepair } from "@/lib/callAgent";
import { AdaptedPlanLLMSchema, type AdaptedPlanLLMOutput, type AdaptedPlanOutput, type PlanNode } from "@/lib/agentSchemas";
import { getArchetype } from "@/lib/archetypes";
import { validatePlanAgainstArchetype } from "@/lib/validatePlan";
import { FIXTURE_PLAN } from "@/lib/planFixtures";
import type { CampaignArchetype } from "@/types";

type Body = { brief?: string; archetype?: { id: string; version?: string } };

export const Route = createFileRoute("/api/adapt-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { brief, archetype: pick } = (await request.json()) as Body;

        let config;
        try { config = resolveGatewayConfig(); } catch {
          return Response.json({ plan: toOutput(FIXTURE_PLAN), cost_usd: 0 });
        }
        const sel = pick?.id ? getArchetype(pick.id, pick?.version) : getArchetype("paid-media-launch");
        if (!sel) return Response.json({ error: "unknown archetype" }, { status: 400 });

        const gateway = createAiGatewayProvider(config);

        // The LLM now returns only the judgment parts (adaptation_params +
        // proposed_extras + rationale); the 14 deterministic nodes are rebuilt
        // server-side. That keeps the call small/fast, so a modest soft deadline
        // under Vercel's 10s function cap is plenty of headroom.
        const LLM_DEADLINE_MS = 9_500;

        try {
          const llmPromise = tryWithModelFallback(async (modelId) => {
            const { output, usage } = await callAgentWithRepair({
              model: gateway(modelId),
              schema: AdaptedPlanLLMSchema,
              system: buildAdaptSystemPrompt(sel),
              prompt: `Brief:\n${brief ?? ""}\n\nAdapt archetype ${sel.id} v${sel.version}.`,
              // Reconstruct the deterministic node graph from the archetype, then
              // validate it inside the repair loop — so bad params / proposed_extras
              // get a self-repair turn instead of failing straight to the fixture.
              validate: (llm) => validatePlanAgainstArchetype(assemblePlan(llm, sel), sel),
            });
            return { plan: assemblePlan(output, sel), cost_usd: estimateCostUsd(usage) };
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("adapt-plan LLM deadline exceeded")), LLM_DEADLINE_MS),
          );

          const { result } = await Promise.race([llmPromise, timeoutPromise]);
          return Response.json({ plan: result.plan, cost_usd: result.cost_usd });
        } catch (e) {
          console.error("adapt-plan failed:", e);
          return Response.json({ plan: toOutput(FIXTURE_PLAN), cost_usd: 0 });
        }
      },
    },
  },
});

export function buildAdaptSystemPrompt(a: ReturnType<typeof getArchetype> & {}): string {
  if (!a) return "";
  const slots = a.adaptation_slots.map((s) => `${s.id}: ${s.type}${s.constraints ? ` ${JSON.stringify(s.constraints)}` : ""}`).join("; ");
  return `You are the plan-adaptation agent. Adapt the ${a.id} v${a.version} archetype to the brief.
The canonical workflow steps are fixed by the archetype and are assembled automatically — DO NOT return a "nodes" array.
Your job is to decide the adaptation:
- Fill adaptation_params for EVERY slot: ${slots}
- Optionally propose EXTRA gates/steps via proposed_extras. Each: { kind: "gate"|"step", id, after (an existing step id it follows), rationale, label? }. Only add an extra when the brief genuinely warrants it.
- Provide a selection_rationale (decided, why[], alternatives[], confidence 0..1, knowledge_cited[]).

Return ONLY valid JSON (no markdown, no explanation). Start your response with "{".`;
}

/** Reconstruct the full adapted plan: deterministic archetype nodes + any
 *  LLM-proposed extras, woven into the DAG after the step they follow. */
export function assemblePlan(llm: AdaptedPlanLLMOutput, a: CampaignArchetype): AdaptedPlanOutput {
  return {
    archetype_id: llm.archetype_id,
    archetype_version: llm.archetype_version,
    adaptation_params: llm.adaptation_params,
    proposed_extras: llm.proposed_extras?.map((e) => ({ kind: e.kind, id: e.id, after: e.after, rationale: e.rationale })),
    nodes: buildNodesFromArchetype(a, llm.proposed_extras),
    selection_rationale: llm.selection_rationale,
  };
}

function buildNodesFromArchetype(a: CampaignArchetype, extras?: AdaptedPlanLLMOutput["proposed_extras"]): PlanNode[] {
  const nodes: PlanNode[] = a.steps.map((s) => ({
    id: s.id,
    kind: s.kind,
    label: s.label,
    gate: s.gate,
    depends_on: [...s.depends_on],
    task_type: s.kind === "agent" ? s.task_type : undefined,
  }));
  for (const ex of extras ?? []) {
    // Rewire successors of `after` to depend on the extra, so it sits in the chain.
    for (const n of nodes) {
      const i = n.depends_on.indexOf(ex.after);
      if (i !== -1) n.depends_on[i] = ex.id;
    }
    const kind: PlanNode["kind"] = ex.kind === "gate" ? "gate" : "agent";
    nodes.push({
      id: ex.id,
      kind,
      label: ex.label ?? synthLabel(ex),
      gate: kind === "gate" ? synthGateId(ex.id) : undefined,
      depends_on: [ex.after],
      task_type: undefined,
    });
  }
  return nodes;
}

function synthGateId(id: string): string {
  const m = id.match(/^h[_-]?(.+)$/i);
  return m ? `H-${m[1]}` : id.toUpperCase();
}

function synthLabel(ex: { kind: "gate" | "step"; id: string }): string {
  return ex.kind === "gate" ? `${synthGateId(ex.id)} — Proposed gate` : `${ex.id} — Proposed step`;
}

function toOutput(p: typeof FIXTURE_PLAN): AdaptedPlanOutput {
  return {
    archetype_id: p.archetype.id,
    archetype_version: p.archetype.version,
    adaptation_params: p.adaptation_params,
    proposed_extras: p.proposed_extras,
    nodes: p.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, gate: n.gate, depends_on: n.depends_on, task_type: n.task_id })),
    selection_rationale: p.selection_rationale,
  };
}

function estimateCostUsd(usage: { inputTokens?: number; outputTokens?: number } | undefined): number {
  if (!usage) return 0;
  return Number((((usage.inputTokens ?? 0) / 1_000_000) * 15 + ((usage.outputTokens ?? 0) / 1_000_000) * 75).toFixed(4));
}
