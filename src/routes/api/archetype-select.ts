import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { createAiGatewayProvider, resolveGatewayConfig, tryWithModelFallback } from "@/lib/ai-gateway.server";
import { ArchetypeSelectOutputSchema, type ArchetypeSelectOutput } from "@/lib/agentSchemas";
import { ARCHETYPES } from "@/lib/archetypes";
import { FIXTURE_SELECT } from "@/lib/planFixtures";

// Pure + exported so the demo branch is unit-testable without a server.
export function buildArchetypeSelectSystemPrompt(): string {
  const library = ARCHETYPES.map((a) => `- ${a.id} v${a.version}: ${a.label} — ${a.description}`).join("\n");
  return `You are the archetype-selection agent for Hilti's campaign platform.
Given a free-text campaign brief, choose the SINGLE best-fitting Campaign Archetype from this library:
${library}

Return the archetype id + exact version, plus a DecisionRationale (decided, why, alternatives rejected, confidence 0..1, knowledge_cited).`;
}

type Body = { brief?: string };

export const Route = createFileRoute("/api/archetype-select")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { brief } = (await request.json()) as Body;
        // Try live LLM, fall back to fixture if gateway is unavailable
        let config;
        try { config = resolveGatewayConfig(); } catch (e) {
          return Response.json({
            ...FIXTURE_SELECT,
            _diag: {
              error: e instanceof Error ? e.message : String(e),
              has_key: String(!!process.env.LLM_580_API_KEY),
              has_url: String(!!process.env.LLM_580_BASE_URL),
              url_val: (process.env.LLM_580_BASE_URL ?? "NOT SET").slice(0, 40),
            },
          });
        }
        const gateway = createAiGatewayProvider(config);
        try {
          const { result: object, model } = await tryWithModelFallback(async (modelId) => {
            const { object } = await generateObject({
              model: gateway(modelId),
              schema: ArchetypeSelectOutputSchema,
              system: buildArchetypeSelectSystemPrompt(),
              prompt: `Brief:\n${brief ?? "(no brief)"}`,
            });
            return object as ArchetypeSelectOutput;
          });
          return Response.json({ ...object, _model_used: model });
        } catch (e) {
          console.error("archetype-select failed:", e);
          return Response.json(FIXTURE_SELECT);
        }
      },
    },
  },
});
