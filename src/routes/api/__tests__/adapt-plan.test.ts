import { describe, it, expect } from "vitest";
import { buildAdaptSystemPrompt } from "../adapt-plan";
import { getArchetype } from "@/lib/archetypes";

describe("adapt-plan helper", () => {
  it("includes the canonical step sequence and slot bounds in the prompt", () => {
    const p = buildAdaptSystemPrompt(getArchetype("paid-media-launch", "1.5.0")!);
    expect(p).toMatch(/brief .*\(agent\).* → .*strategy .*\(agent\)/);
    expect(p).toMatch(/variants_per_segment: integer/);
    expect(p).toMatch(/"min":\s*1\s*,\s*"max":\s*5/);
  });
});
