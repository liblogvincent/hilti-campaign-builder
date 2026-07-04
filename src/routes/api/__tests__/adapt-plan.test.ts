import { describe, it, expect } from "vitest";
import { buildAdaptSystemPrompt } from "../adapt-plan";
import { getArchetype } from "@/lib/archetypes";

describe("adapt-plan helper", () => {
  it("instructs the LLM not to emit nodes and lists the slot bounds", () => {
    const p = buildAdaptSystemPrompt(getArchetype("paid-media-launch", "1.5.0")!);
    expect(p).toMatch(/do not return a "nodes" array/i);
    expect(p).toMatch(/variants_per_segment: integer/);
    expect(p).toMatch(/"min":\s*1\s*,\s*"max":\s*5/);
  });
});
