import { createFileRoute } from "@tanstack/react-router";
import { generateText, generateObject } from "ai";
import { createAiGatewayProvider, resolveGatewayConfig } from "@/lib/ai-gateway.server";
import { AGENT_SCHEMA_MAP, AGENT_SCHEMA_NAMES } from "@/lib/agentSchemas";

type Body = {
  brief: string;
  nodeId: string;
  nodeLabel: string;
  taskType?: string;
  planContext: string;
  /** When set, use generateObject with the matching schema instead of generateText. */
  schema?: string;
};

export const Route = createFileRoute("/api/execute-node")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { brief, nodeId, nodeLabel, taskType, planContext, schema } = (await request.json()) as Body;
        const live = (import.meta.env.VITE_LIVE_AGENT ?? "") === "true";

        if (!live) {
          if (schema) return Response.json({ output: {}, cost_usd: 0 });
          return Response.json({
            output: `[demo] ${nodeLabel} output for: ${brief.slice(0, 80)}…`,
            cost_usd: 0,
          });
        }

        let config;
        try { config = resolveGatewayConfig(); } catch {
          if (schema) return Response.json({ output: {}, cost_usd: 0 });
          return Response.json({
            output: `[no-gateway] ${nodeLabel} — AI gateway not configured.`,
            cost_usd: 0,
          });
        }

        const modelId = process.env.LLM_MODEL || "claude-opus-4-8";
        const gateway = createAiGatewayProvider(config);

        // Structured output path (a0, a2, c1, etc.)
        if (schema) {
          const zodSchema = AGENT_SCHEMA_MAP[taskType || ""];
          if (!zodSchema) {
            return Response.json({ error: `unknown schema for task_type: ${taskType}` }, { status: 400 });
          }

          const systemPrompt = buildSpecialistPrompt(nodeId, nodeLabel, taskType);
          const { object, usage } = await generateObject({
            model: gateway(modelId),
            schema: zodSchema,
            system: systemPrompt,
            prompt: `Campaign brief:\n"""\n${brief}\n"""\n\nPlan context (completed phases):\n"""\n${planContext || "(none yet)"}\n"""\n\nYour task: produce the structured output for the **${nodeLabel}** phase.`,
          });

          const cost_usd = estimateCostUsd(usage);
          return Response.json({ output: object, cost_usd });
        }

        // Free-text path (fallback for nodes without a schema)
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
  const base = `You are the **${nodeLabel}** specialist in an AI-powered marketing campaign builder for Hilti, a professional construction tools company (B2B, not consumer). Your output will be reviewed by a human campaign manager at a gate checkpoint. Be specific, actionable, and grounded in the brief.`;

  const rationaleNote = `\n\nAlways include a decision_rationale with: what you decided (one sentence), why (at least 2 reasons), alternatives you considered and rejected (at least 1), and your confidence score (0.0–1.0).`;

  const specialistGuides: Record<string, string> = {
    brief_intake: `${base}\n\nStructure the raw brief into a clean campaign brief. Extract: objective, product details, audience segments, geography, budget, timeline, channels, and landing pages. Flag any missing mandatory fields in the completeness section.${rationaleNote}`,
    campaign_plan: `${base}\n\nGenerate a paid media strategy plan. First, analyze the competitive landscape and market conditions for the product/market combination — consider seasonal factors, competitor activity, and benchmark KPIs for similar campaigns. Then: allocate budget across channels with rationale, define audience targeting per channel, set KPI targets (ROAS, CPA ceiling), and define 2-3 messaging pillars.${rationaleNote}`,
    create_ad_set: `${base}\n\nGenerate ad copy variants for the requested channels. For each variant provide: channel, headline (max 40 chars recommended), body copy (max 125 chars recommended), CTA, target segment, and locale. Vary messaging by segment. Use construction-industry terminology appropriate for professionals.${rationaleNote}`,
    voice_fit_review: `${base}\n\nReview the content against Hilti brand standards: check for prohibited claims (avoid 'revolutionary', 'game-changer', 'cheapest', 'guaranteed', 'never fails', '100%'), verify professional B2B tone, flag missing legal disclaimers (especially for chemical/anchoring products), and check product naming conventions. Rate each flag by severity (critical/high/medium/low) and suggest fixes.${rationaleNote}`,
    rollout_sequence: `${base}\n\nGenerate the rollout plan: which connectors to use (Contentful for landing pages, DAM for assets, ad platforms for publishing), in what order, with what configuration. List each connector call with its purpose and any required parameters.${rationaleNote}`,
    insights: `${base}\n\nAnalyze the completed campaign and propose 2-3 specific skills that should be promoted to the organization's skill registry for reuse. Each proposal needs a name and description.${rationaleNote}`,
    localize: `${base}\n\nLocalize the ad copy for the target markets. For each locale, adapt (don't just translate) the messaging to local construction terminology and practices. Produce localized ad variants with the same structure as the source.${rationaleNote}`,
    utm_create_qa: `${base}\n\nGenerate UTM parameters for each channel in the campaign. Follow Hilti UTM naming conventions. For each channel, output: utm_source, utm_medium, utm_campaign, utm_content (optional), utm_term (optional), and the landing_url. Use consistent naming that enables cross-channel attribution.${rationaleNote}`,
  };

  return specialistGuides[role] ?? `${base}\n\nExecute the ${nodeLabel} phase for this campaign. Produce concrete, structured output.${rationaleNote}`;
}

function estimateCostUsd(usage: { inputTokens?: number; outputTokens?: number } | undefined): number {
  if (!usage) return 0;
  return Number((((usage.inputTokens ?? 0) / 1_000_000) * 15 + ((usage.outputTokens ?? 0) / 1_000_000) * 75).toFixed(4));
}
