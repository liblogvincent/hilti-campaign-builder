import { createFileRoute } from "@tanstack/react-router";
import { createAiGatewayProvider, resolveGatewayConfig, tryWithModelFallback } from "@/lib/ai-gateway.server";
import { callAgentWithRepair } from "@/lib/callAgent";
import { AdaptedPlanLLMSchema, type AdaptedPlanLLMOutput, type AdaptedPlanOutput, type PlanNode } from "@/lib/agentSchemas";
import { getArchetype } from "@/lib/archetypes";
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

        // The LLM returns only the judgment parts (adaptation_params +
        // proposed_extras + rationale); the deterministic node graph AND
        // archetype conformance are enforced server-side in assemblePlan
        // (backfill defaults, filter enums, drop invalid extras, rebuild nodes).
        // So there's no self-repair loop for adapt-plan — a single ~6s call
        // through 580ai returns a conformant, brief-specific plan well under
        // Vercel's ~10s function budget. The deadline is only a hang guard.
        const LLM_DEADLINE_MS = 55_000;

        try {
          const llmPromise = tryWithModelFallback(async (modelId) => {
            const { output, usage } = await callAgentWithRepair({
              model: gateway(modelId),
              schema: AdaptedPlanLLMSchema,
              system: buildAdaptSystemPrompt(sel),
              prompt: `Brief:\n${brief ?? ""}\n\nAdapt archetype ${sel.id} v${sel.version}.`,
            });
            return { plan: assemblePlan(output, sel), cost_usd: estimateCostUsd(usage) };
          });

          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("adapt-plan LLM deadline exceeded")), LLM_DEADLINE_MS),
          );

          const { result, model } = await Promise.race([llmPromise, timeoutPromise]);
          return Response.json({ plan: result.plan, cost_usd: result.cost_usd, _model_used: model });
        } catch (e) {
          console.error("adapt-plan failed:", e);
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ plan: toOutput(FIXTURE_PLAN), cost_usd: 0, _error: msg.slice(0, 200) });
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

/** Reconstruct the full adapted plan and enforce archetype conformance
 *  server-side: normalize params (backfill required slot defaults, filter
 *  channel enums), drop invalid proposed_extras, and rebuild the node DAG. */
export function assemblePlan(llm: AdaptedPlanLLMOutput, a: CampaignArchetype): AdaptedPlanOutput {
  const stepIds = new Set(a.steps.map((s) => s.id));
  const extras = sanitizeExtras(llm.proposed_extras, stepIds);
  return {
    archetype_id: llm.archetype_id,
    archetype_version: llm.archetype_version,
    adaptation_params: normalizeParams(llm.adaptation_params ?? {}, a),
    proposed_extras: extras.map((e) => ({ kind: e.kind, id: e.id, after: e.after, rationale: e.rationale })),
    nodes: buildNodesFromArchetype(a, extras),
    selection_rationale: llm.selection_rationale,
  };
}

/** Backfill required slots from archetype defaults and clamp/filter values so
 *  the plan always satisfies the archetype's slot constraints. */
function normalizeParams(raw: Record<string, unknown>, a: CampaignArchetype): Record<string, unknown> {
  const out: Record<string, unknown> = { ...raw };
  for (const slot of a.adaptation_slots) {
    const v = out[slot.id];
    const has = v !== undefined && v !== null;
    if (slot.type === "channels" || slot.type === "string_array" || slot.type === "extra_gates") {
      let arr = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
      const enumv = slot.constraints?.enum;
      if (enumv && enumv.length) arr = arr.filter((x) => enumv.includes(x));
      if (arr.length === 0 && Array.isArray(slot.default)) arr = slot.default as string[];
      if (slot.required || has) out[slot.id] = arr;
    } else if (slot.type === "integer") {
      let n = typeof v === "number" && Number.isInteger(v) ? v : (typeof slot.default === "number" ? slot.default : 1);
      const c = slot.constraints;
      if (c?.min !== undefined) n = Math.max(c.min, n);
      if (c?.max !== undefined) n = Math.min(c.max, n);
      out[slot.id] = n;
    }
  }
  return out;
}

/** Keep only well-formed extras: non-empty rationale, `after` points at a real
 *  archetype step, and the id doesn't collide with a canonical step. */
function sanitizeExtras(
  extras: AdaptedPlanLLMOutput["proposed_extras"],
  stepIds: Set<string>,
): NonNullable<AdaptedPlanLLMOutput["proposed_extras"]> {
  return (extras ?? []).filter((e) => e.rationale?.trim() && stepIds.has(e.after) && !stepIds.has(e.id));
}

function buildNodesFromArchetype(a: CampaignArchetype, extras: NonNullable<AdaptedPlanLLMOutput["proposed_extras"]>): PlanNode[] {
  const nodes: PlanNode[] = a.steps.map((s) => ({
    id: s.id,
    kind: s.kind,
    label: s.label,
    gate: s.gate,
    depends_on: [...s.depends_on],
    task_type: s.kind === "agent" ? s.task_type : undefined,
  }));
  for (const ex of extras) {
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
