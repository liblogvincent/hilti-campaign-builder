import { describe, it, expect } from "vitest";
import { mapPlanToRunNodes } from "../planMapper";
import { FIXTURE_PLAN } from "../planFixtures";
import { validatePlanAgainstArchetype } from "../validatePlan";
import { getArchetype } from "../archetypes";

describe("plan mapper + fixtures", () => {
  it("maps a lean plan to RunNodes all in 'waiting' status", () => {
    const nodes = mapPlanToRunNodes({
      archetype_id: "paid-media-launch", archetype_version: "1.4.0",
      adaptation_params: {},
      nodes: [{ id: "brief", kind: "agent", label: "Brief", depends_on: [] }],
      selection_rationale: { decided: "x", why: [], alternatives: [], confidence: 0.5, knowledge_cited: [] },
    });
    expect(nodes[0].status).toBe("waiting");
    expect(nodes[0].kind).toBe("agent");
  });

  it("the fixture plan validates against paid-media-launch", () => {
    const r = validatePlanAgainstArchetype(FIXTURE_PLAN, getArchetype("paid-media-launch", "1.4.0")!);
    expect(r.valid).toBe(true);
  });
});
