import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createAiGatewayProvider, resolveGatewayConfig } from "@/lib/ai-gateway.server";

type Body = {
  brief: string;
  nodeId: string;
  nodeLabel: string;
  taskType?: string;
  /** The plan context: archetype name, what's been done so far */
  planContext: string;
};

export const Route = createFileRoute("/api/execute-node")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { brief, nodeId, nodeLabel, taskType, planContext } = (await request.json()) as Body;
        const live = (import.meta.env.VITE_LIVE_AGENT ?? "") === "true";

        if (!live) {
          return Response.json({
            output: `[demo] ${nodeLabel} output for: ${brief.slice(0, 80)}…`,
            cost_usd: 0,
          });
        }

        let config;
        try {
          config = resolveGatewayConfig();
        } catch {
          return Response.json({
            output: `[no-gateway] ${nodeLabel} — AI gateway not configured.`,
            cost_usd: 0,
          });
        }

        const modelId = process.env.LLM_MODEL || "claude-opus-4-8";
        const gateway = createAiGatewayProvider(config);
        const systemPrompt = buildSpecialistPrompt(nodeId, nodeLabel, taskType);

        const { text, usage } = await generateText({
          model: gateway(modelId),
          system: systemPrompt,
          prompt: `Campaign brief:\n"""\n${brief}\n"""\n\nPlan context (what's happened so far):\n"""\n${planContext}\n"""\n\nYour task: produce the output for the **${nodeLabel}** phase.`,
        });

        const cost_usd = estimateCostUsd(usage);
        return Response.json({ output: text, cost_usd });
      },
    },
  },
});

function buildSpecialistPrompt(nodeId: string, nodeLabel: string, taskType?: string): string {
  const role = taskType || nodeId;
  const base = `You are the **${nodeLabel}** specialist in an AI-powered marketing campaign builder for Hilti, a professional construction tools company. Your output will be reviewed by a human campaign manager at a gate checkpoint. Be specific, actionable, and grounded in the brief. Use Hilti-relevant terminology (construction professionals, not consumers).`;

  const specialistGuides: Record<string, string> = {
    strategy: `${base}\n\nGenerate a paid media strategy: channel allocation with rationale, audience targeting recommendations, budget pacing across the campaign timeline, and key messaging pillars. Reference the brief's product, market, and KPI targets.`,
    content: `${base}\n\nGenerate ad copy variants for the requested channels. For each variant provide: headline (max 40 chars recommended), body copy (max 125 chars recommended), CTA, and a brief note on which audience segment it targets. If multiple locales are requested, suggest a primary locale version with notes for localization.`,
    qa: `${base}\n\nReview the content against Hilti brand standards: check for prohibited claims, verify product naming conventions, flag missing legal disclaimers (especially for chemical/anchoring products), and confirm all mandatory elements are present. Output a structured pass/fail with specific fixes needed.`,
    rollout: `${base}\n\nGenerate the rollout plan: which connectors to use (Contentful for landing pages, DAM for assets, ad platforms for publishing), in what order, with what configuration. List each connector call with its purpose and any required parameters.`,
    learn: `${base}\n\nAnalyze the completed campaign: what worked, what could be improved, what skills/patterns should be promoted for reuse. Propose 2-3 specific skill proposals with names, descriptions, and scoping (brand, market, channel applicability).`,
    localization: `${base}\n\nLocalize the content for the target markets. For each locale, adapt (don't just translate) the messaging to local construction terminology and practices. Flag any market-specific regulatory requirements that affect the copy.`,
  };

  return specialistGuides[role] ?? `${base}\n\nExecute the ${nodeLabel} phase for this campaign. Produce concrete, structured output that the next phase or a human reviewer can act on.`;
}

function estimateCostUsd(usage: { inputTokens?: number; outputTokens?: number } | undefined): number {
  if (!usage) return 0;
  const inUsd = ((usage.inputTokens ?? 0) / 1_000_000) * 15;
  const outUsd = ((usage.outputTokens ?? 0) / 1_000_000) * 75;
  return Number((inUsd + outUsd).toFixed(4));
}
