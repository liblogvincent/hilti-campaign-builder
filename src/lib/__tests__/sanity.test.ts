import { describe, it, expect } from "vitest";
import { ArchetypeSelectOutputSchema, AdaptedPlanOutputSchema } from "../agentSchemas";

describe("agent schemas sanity", () => {
  it("parses a valid archetype-select output", () => {
    const out = {
      archetype_id: "paid-media-launch",
      archetype_version: "1.5.0",
      selection_rationale: {
        decided: "paid-media launch",
        why: ["paid channels in brief"],
        alternatives: [{ option: "product-launch", rejected_reason: "no new product" }],
        confidence: 0.9,
        knowledge_cited: ["art_b2b_linkedin_v3"],
      },
    };
    expect(ArchetypeSelectOutputSchema.parse(out).archetype_id).toBe("paid-media-launch");
  });

  it("parses a minimal adapted plan", () => {
    const plan = {
      archetype_id: "paid-media-launch",
      archetype_version: "1.5.0",
      adaptation_params: { variants_per_segment: 2 },
      nodes: [
        { id: "brief", kind: "agent", label: "Brief", depends_on: [] },
        { id: "h1", kind: "gate", label: "H1", gate: "H1", depends_on: ["brief"] },
      ],
      selection_rationale: {
        decided: "x", why: [], alternatives: [], confidence: 0.5, knowledge_cited: [],
      },
    };
    expect(AdaptedPlanOutputSchema.parse(plan).nodes).toHaveLength(2);
  });
});
