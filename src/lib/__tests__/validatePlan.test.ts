import { describe, it, expect } from "vitest";
import { validatePlanAgainstArchetype, type PlanInput } from "../validatePlan";
import { getArchetype } from "../archetypes";

const A = () => getArchetype("paid-media-launch", "1.5.0")!;

function validPlan(): PlanInput {
  return {
    adaptation_params: { variants_per_segment: 2, channels: ["linkedin"], target_locales: ["de-DE"], segments: ["contractor"] },
    nodes: [
      { id: "brief", kind: "agent", depends_on: [] },
      { id: "strategy", kind: "agent", depends_on: ["brief"] },
      { id: "h1", kind: "gate", gate: "H1", depends_on: ["strategy"] },
      { id: "content", kind: "agent", depends_on: ["h1"] },
      { id: "qa", kind: "agent", depends_on: ["content"] },
      { id: "h2", kind: "gate", gate: "H2", depends_on: ["qa"] },
      { id: "localization", kind: "agent", depends_on: ["h2"] },
      { id: "utm", kind: "agent", depends_on: ["localization"] },
      { id: "rollout", kind: "tool", depends_on: ["utm"] },
      { id: "qa_structural", kind: "agent", depends_on: ["rollout"] },
      { id: "h3", kind: "gate", gate: "H3", depends_on: ["qa_structural"] },
      { id: "learn", kind: "agent", depends_on: ["h3"] },
      { id: "h4", kind: "gate", gate: "H4", depends_on: ["learn"] },
    ],
  };
}

describe("validatePlanAgainstArchetype", () => {
  it("accepts the canonical plan", () => {
    expect(validatePlanAgainstArchetype(validPlan(), A()).valid).toBe(true);
  });

  it("rejects a missing mandatory gate", () => {
    const p = validPlan();
    p.nodes = p.nodes.filter((n) => n.id !== "h2");
    const r = validatePlanAgainstArchetype(p, A());
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/mandatory.*H2/i);
  });

  it("rejects mandatory gates in the wrong relative order", () => {
    const p = validPlan();
    // move H4 before H1 in the sequence
    const h4 = p.nodes.find((n) => n.id === "h4")!;
    p.nodes = [h4, ...p.nodes.filter((n) => n.id !== "h4")];
    expect(validatePlanAgainstArchetype(p, A()).valid).toBe(false);
  });

  it("rejects an out-of-range slot value", () => {
    const p = validPlan();
    (p.adaptation_params as any).variants_per_segment = 99;
    const r = validatePlanAgainstArchetype(p, A());
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/variants_per_segment/i);
  });

  it("rejects a channel outside the enum", () => {
    const p = validPlan();
    (p.adaptation_params as any).channels = ["tiktok"];
    expect(validatePlanAgainstArchetype(p, A()).valid).toBe(false);
  });

  it("rejects a silently-inserted extra node (not declared in proposed_extras)", () => {
    const p = validPlan();
    p.nodes.splice(5, 0, { id: "h_legal", kind: "gate", gate: "H-legal", depends_on: ["qa"] });
    const r = validatePlanAgainstArchetype(p, A());
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/h_legal/i);
  });

  it("accepts a declared proposed extra", () => {
    const p = validPlan();
    p.nodes.splice(5, 0, { id: "h_legal", kind: "gate", gate: "H-legal", depends_on: ["qa"] });
    // re-link h2 to depend on the inserted gate
    p.nodes.find((n) => n.id === "h2")!.depends_on = ["h_legal"];
    p.proposed_extras = [{ kind: "gate", id: "h_legal", after: "qa", rationale: "compliance flag" }];
    expect(validatePlanAgainstArchetype(p, A()).valid).toBe(true);
  });

  it("rejects a cyclic DAG", () => {
    const p = validPlan();
    p.nodes.find((n) => n.id === "brief")!.depends_on = ["h4"]; // cycle
    expect(validatePlanAgainstArchetype(p, A()).valid).toBe(false);
  });

  it("rejects a depends_on reference that does not resolve", () => {
    const p = validPlan();
    p.nodes.find((n) => n.id === "strategy")!.depends_on = ["nope"];
    expect(validatePlanAgainstArchetype(p, A()).valid).toBe(false);
  });
});
