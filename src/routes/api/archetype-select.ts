import { createFileRoute } from "@tanstack/react-router";
import { createAiGatewayProvider, resolveGatewayConfig, tryWithModelFallback } from "@/lib/ai-gateway.server";
import { callAgentWithRepair } from "@/lib/callAgent";
import { ArchetypeSelectOutputSchema, type ArchetypeSelectOutput } from "@/lib/agentSchemas";
import { ARCHETYPES } from "@/lib/archetypes";
import { FIXTURE_SELECT } from "@/lib/planFixtures";

export function buildArchetypeSelectSystemPrompt(): string {
  const library = ARCHETYPES.map((a) => `- ${a.id} v${a.version}: ${a.label} — ${a.description}`).join("\n");
  return `You are the archetype-selection agent for Hilti's campaign platform.
Given a free-text campaign brief, choose the SINGLE best-fitting Campaign Archetype from this library:
${library}

Return ONLY valid JSON (no markdown, no explanation) matching this structure:
{
  "archetype_id": "<id>",
  "archetype_version": "<exact semver from the library, e.g. \"1.5.0\" — do NOT add a \"v\" prefix>",
  "selection_rationale": {
    "decided": "<one-line summary>",
    "why": ["<reason>", ...],
    "alternatives": [{"option": "<id>", "rejected_reason": "<why>"}, ...],
    "confidence": 0.9,
    "knowledge_cited": ["<kb entry>", ...]
  }
}`;
}

type Body = { brief?: string };

export const Route = createFileRoute("/api/archetype-select")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { brief } = (await request.json()) as Body;
        let config;
        try { config = resolveGatewayConfig(); } catch {
          return Response.json(FIXTURE_SELECT);
        }
        const gateway = createAiGatewayProvider(config);
        try {
          const { result: object, model } = await tryWithModelFallback(async (modelId) => {
            const { output } = await callAgentWithRepair({
              model: gateway(modelId),
              schema: ArchetypeSelectOutputSchema,
              system: buildArchetypeSelectSystemPrompt(),
              prompt: `Brief:\n${brief ?? "(no brief)"}`,
            });
            return output as ArchetypeSelectOutput;
          });
          return Response.json({ ...object, _model_used: model });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return Response.json({ ...FIXTURE_SELECT, _error: msg.slice(0, 200) });
        }
      },
    },
  },
});
