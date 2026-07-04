import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { createAiGatewayProvider, resolveGatewayConfig } from "@/lib/ai-gateway.server";
import { AdaptedPlanOutputSchema, type AdaptedPlanOutput } from "@/lib/agentSchemas";
import { getArchetype } from "@/lib/archetypes";
import { validatePlanAgainstArchetype } from "@/lib/validatePlan";
import { FIXTURE_PLAN } from "@/lib/planFixtures";
import { mapPlanToRunNodes } from "@/lib/planMapper";

type Body = { brief?: string; archetype?: { id: string; version?: string } };

export const Route = createFileRoute("/api/adapt-plan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { brief, archetype: pick } = (await request.json()) as Body;
        const live = (import.meta.env.VITE_LIVE_AGENT ?? "") === "true";

        if (!live) {
          // Re-validate the fixture plan server-side too (keeps the guard honest).
          const a = getArchetype(FIXTURE_PLAN.archetype.id, FIXTURE_PLAN.archetype.version)!;
          const v = validatePlanAgainstArchetype(FIXTURE_PLAN, a);
          if (!v.valid) return Response.json({ error: "fixture plan invalid", errors: v.errors }, { status: 500 });
          return Response.json({ plan: toOutput(FIXTURE_PLAN), cost_usd: 0 });
        }

        let config;
        try { config = resolveGatewayConfig(); } catch {
          return Response.json({ plan: toOutput(FIXTURE_PLAN), cost_usd: 0 });
        }
        const sel = pick?.id ? getArchetype(pick.id, pick?.version) : getArchetype("paid-media-launch");
        if (!sel) return Response.json({ error: "unknown archetype" }, { status: 400 });

        const modelId = process.env.LLM_MODEL || "claude-opus-4-8";
        const gateway = createAiGatewayProvider(config);
        try {
          const { object, usage } = await generateObject({
            model: gateway(modelId),
            schema: AdaptedPlanOutputSchema,
            system: buildAdaptSystemPrompt(sel),
            prompt: `Brief:\n${brief ?? ""}\n\nAdapt archetype ${sel.id} v${sel.version}.`,
          });
          // Server-side guard: the generated plan MUST conform to the archetype.
          const v = validatePlanAgainstArchetype(object, sel);
          if (!v.valid) return Response.json({ error: "plan failed validation", errors: v.errors }, { status: 422 });
          const cost_usd = estimateCostUsd(usage);
          return Response.json({ plan: object, cost_usd });
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
  const steps = a.steps.map((s) => `${s.id} (${s.kind}${s.gate ? " " + s.gate : ""})`).join(" → ");
  const slots = a.adaptation_slots.map((s) => `${s.id}: ${s.type}${s.constraints ? ` ${JSON.stringify(s.constraints)}` : ""}`).join("; ");
  return `You are the plan-adaptation agent. Adapt the ${a.id} v${a.version} archetype to the brief.
Canonical steps (id (kind)): ${steps}
Mandatory gates in order: ${a.mandatory_gates.join(" → ")}
Fill these adaptation_slots: ${slots}
Emit each canonical step as a node with correct depends_on. You may propose EXTRA gates/steps via proposed_extras (each needs a rationale + the step id it follows) — never insert an extra node without declaring it.
Return adaptation_params for every slot.`;
}

function toOutput(p: typeof FIXTURE_PLAN): AdaptedPlanOutput {
  return {
    archetype_id: p.archetype.id,
    archetype_version: p.archetype.version,
    adaptation_params: p.adaptation_params,
    proposed_extras: p.proposed_extras,
    nodes: p.nodes.map((n) => ({ id: n.id, kind: n.kind, label: n.label, gate: n.gate, depends_on: n.depends_on, task_type: n.task_id?.replace(/^task_/, "") })),
    selection_rationale: p.selection_rationale,
  };
}

// Cost attribution: convert AI SDK usage → USD. Tunable; keep conservative.
// AI SDK v7's LanguageModelUsage exposes inputTokens/outputTokens (renamed from
// the v3/4 promptTokens/completionTokens the original brief assumed).
function estimateCostUsd(usage: { inputTokens?: number; outputTokens?: number } | undefined): number {
  if (!usage) return 0;
  const inUsd = (usage.inputTokens ?? 0) / 1_000_000 * 15;
  const outUsd = (usage.outputTokens ?? 0) / 1_000_000 * 75;
  return Number((inUsd + outUsd).toFixed(4));
}
