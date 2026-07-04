import { describe, it, expect } from "vitest";
import { ARCHETYPES, getArchetype } from "../archetypes";

describe("archetype library", () => {
  it("exposes the four RMB campaign types", () => {
    const ids = ARCHETYPES.map((a) => a.id).sort();
    expect(ids).toEqual(["content-update", "paid-media-launch", "product-launch", "regional-rollout"]);
  });

  it("paid-media-launch has the canonical step + gate structure", () => {
    const a = getArchetype("paid-media-launch", "1.4.0")!;
    expect(a.mandatory_gates).toEqual(["H1", "H2", "H3", "H4"]);
    const ids = a.steps.map((s) => s.id);
    expect(ids).toEqual(["brief", "h1", "strategy", "content", "qa", "h2", "rollout", "h3", "learn", "h4"]);
    expect(a.steps.find((s) => s.id === "qa")!.kind).toBe("tool");
    expect(a.steps.find((s) => s.id === "h1")!.kind).toBe("gate");
  });

  it("getArchetype defaults to latest version", () => {
    expect(getArchetype("paid-media-launch")?.version).toBe("1.4.0");
  });

  it("adaptation slots declare variants_per_segment with bounds", () => {
    const a = getArchetype("paid-media-launch")!;
    const slot = a.adaptation_slots.find((s) => s.id === "variants_per_segment")!;
    expect(slot.constraints).toEqual({ min: 1, max: 5 });
  });
});
