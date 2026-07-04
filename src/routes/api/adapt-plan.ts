import { createFileRoute } from "@tanstack/react-router";
import { createAiGatewayProvider, resolveGatewayConfig, tryWithModelFallback } from "@/lib/ai-gateway.server";
import { callAgentWithRepair } from "@/lib/callAgent";
import { AdaptedPlanOutputSchema, type AdaptedPlanOutput } from "@/lib/agentSchemas";
import { getArchetype } from "@/lib/archetypes";
import { validatePlanAgainstArchetype } from "@/lib/validatePlan";
import { FIXTURE_PLAN } from "@/lib/planFixtures";

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
        try {
          const { result: plan, model } = await tryWithModelFallback(async (modelId) => {
            const { output } = await callAgentWithRepair({
              model: gateway(modelId),
              schema: AdaptedPlanOutputSchema,
              system: buildAdaptSystemPrompt(sel),
              prompt: `Brief:\n${brief ?? ""}\n\nAdapt archetype ${sel.id} v${sel.version}.`,
            });
            const v = validatePlanAgainstArchetype(output as AdaptedPlanOutput, sel);
            if (!v.valid) throw new Error(`validation: ${v.errors.join("; ")}`);
            return { plan: output as AdaptedPlanOutput, cost_usd: 0 };
          });
          return Response.json({ plan, cost_usd: 0 });
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
Return adaptation_params for every slot.

Return ONLY valid JSON (no markdown, no explanation) matching the adapted-plan schema. Start your response with "{".`;
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
