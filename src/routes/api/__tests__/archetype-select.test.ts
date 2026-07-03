import { describe, it, expect } from "vitest";
import { buildArchetypeSelectSystemPrompt } from "../archetype-select";

describe("archetype-select helper", () => {
  it("lists all four archetypes in the system prompt", () => {
    const p = buildArchetypeSelectSystemPrompt();
    expect(p).toMatch(/paid-media-launch/);
    expect(p).toMatch(/product-launch/);
    expect(p).toMatch(/regional-rollout/);
    expect(p).toMatch(/content-update/);
  });
});
