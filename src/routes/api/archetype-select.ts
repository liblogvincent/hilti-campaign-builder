import { createFileRoute } from "@tanstack/react-router";
import { generateObject } from "ai";
import { createAiGatewayProvider, resolveGatewayConfig } from "@/lib/ai-gateway.server";
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
        const live = (import.meta.env.VITE_LIVE_AGENT ?? "") === "true";

        if (!live) return Response.json(FIXTURE_SELECT);

        let config;
        try { config = resolveGatewayConfig(); } catch {
          return Response.json(FIXTURE_SELECT); // graceful demo fallback
        }
        const modelId = process.env.LLM_MODEL || "claude-opus-4-8";
        const gateway = createAiGatewayProvider(config);
        const { object } = await generateObject({
          model: gateway(modelId),
          schema: ArchetypeSelectOutputSchema,
          system: buildArchetypeSelectSystemPrompt(),
          prompt: `Brief:\n${brief ?? "(no brief)"}`,
        });
        return Response.json(object satisfies ArchetypeSelectOutput);
      },
    },
  },
});
