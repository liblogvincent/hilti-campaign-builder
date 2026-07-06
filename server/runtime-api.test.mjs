import { describe, expect, it } from "vitest";
import { runtimeMode, canUseSupabase, createSupabaseServerClient } from "./supabase-client.mjs";
import { assertRuntimeStatus, normalizeWorkspace } from "./runtime-schema.mjs";
import { createCampaignSnapshotFromFixture } from "./campaign-runtime.mjs";
import { createDefaultRun, campaignPlanForRun, campaignPlanningObjectsFromPlan, contentRequirementsFromPlan } from "../src/lib/panda.ts";

describe("runtime mode", () => {
  it("defaults to local runtime", () => {
    expect(runtimeMode({})).toBe("local");
  });

  it("uses supabase only when explicitly selected and configured", () => {
    const env = {
      PANDA_RUNTIME_MODE: "supabase",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };
    expect(runtimeMode(env)).toBe("supabase");
    expect(canUseSupabase(env)).toBe(true);
  });

  it("falls back to local when supabase mode is missing credentials", () => {
    expect(runtimeMode({ PANDA_RUNTIME_MODE: "supabase" })).toBe("local");
  });

  it("creates no client in local mode", () => {
    expect(createSupabaseServerClient({ PANDA_RUNTIME_MODE: "local" })).toBeUndefined();
  });
});

describe("runtime schema helpers", () => {
  it("normalizes unknown workspace to home", () => {
    expect(normalizeWorkspace("bad")).toBe("home");
  });

  it("accepts valid work object statuses", () => {
    expect(assertRuntimeStatus("in-review")).toBe("in-review");
  });

  it("rejects invalid work object statuses", () => {
    expect(() => assertRuntimeStatus("published")).toThrow("Invalid runtime status");
  });
});

describe("campaign snapshot runtime", () => {
  it("creates a canonical snapshot from fixture state", () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const snapshot = createCampaignSnapshotFromFixture({
      run,
      plan,
      planningObjects: campaignPlanningObjectsFromPlan(plan),
      contentRequirements: contentRequirementsFromPlan(plan),
    });

    expect(snapshot.campaign.id).toBe(run.campaignId);
    expect(snapshot.plan.campaignId).toBe(run.campaignId);
    expect(snapshot.workObjects.some((item) => item.workspace === "campaign-planning")).toBe(true);
    expect(snapshot.contentRequirements.length).toBeGreaterThan(0);
  });
});
