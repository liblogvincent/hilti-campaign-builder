import { describe, expect, it } from "vitest";
import { runtimeMode, canUseSupabase, createSupabaseServerClient } from "./supabase-client.mjs";
import { assertRuntimeStatus, normalizeWorkspace } from "./runtime-schema.mjs";
import { createCampaignSnapshotFromFixture, loadCampaignSnapshot } from "./campaign-runtime.mjs";
import { executeRuntimeAction } from "./object-runtime.mjs";
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

  it("maps snake_case supabase rows into camelCase snapshot fields", async () => {
    const fakeSupabase = {
      from(table) {
        const datasets = {
          campaigns: { data: { id: "camp_04", name: "Fixture Campaign", brief: "A brief", phase: "planning", active_gate: "H1", owner_role: "Campaign Owner", updated_at: "2026-07-06T00:00:00.000Z" }, error: null },
          campaign_plans: {
            data: [
              {
                campaign_id: "camp_04",
                name: "Plan 1",
                hero_product: "Product",
                markets: [],
                locales: [],
                audience: [],
                budget: "EUR 100",
                timeline: "2 weeks",
                channels: [],
                kpis: [],
                assumptions: [],
              },
            ],
            error: null,
          },
          work_objects: {
            data: [
              {
                id: "wo-1",
                campaign_id: "camp_04",
                workspace: "campaign-planning",
                title: "Objectives",
                lane: "Strategy",
                owner_role: "Campaign Owner",
                status: "draft",
                gate: "H1",
                copy: "",
                evidence: [],
                source: "CampaignPlan",
                updated_at: "2026-07-06T00:00:01.000Z",
              },
            ],
            error: null,
          },
          content_requirements: {
            data: [
              {
                id: "cr-1",
                campaign_id: "camp_04",
                channel: "Email",
                asset_type: "copy",
                title: "Welcome sequence",
                locale: "master",
                owner_role: "Campaign Owner",
                rollout_target: "Contentful",
                status: "in-review",
                evidence: [],
                updated_at: "2026-07-06T00:00:02.000Z",
              },
            ],
            error: null,
          },
          gate_decisions: {
            data: [
              {
                id: 10,
                campaign_id: "camp_04",
                gate: "H1",
                decision: "revision-requested",
                reviewer: "Campaign Owner",
                comment: "Needs revision",
                created_at: "2026-07-06T00:00:03.000Z",
              },
            ],
            error: null,
          },
          runtime_events: {
            data: [
              {
                id: "ev-1",
                campaign_id: "camp_04",
                workspace: "campaign-planning",
                type: "agent_message",
                actor: "campaign-planning-specialist",
                payload: { note: "ok" },
                created_at: "2026-07-06T00:00:04.000Z",
              },
            ],
            error: null,
          },
        };

        const result = datasets[table] || { data: [], error: null };
        const thenable = {
          select() {
            return thenable;
          },
          eq() {
            return thenable;
          },
          order() {
            return thenable;
          },
          limit() {
            return thenable;
          },
          single() {
            return Promise.resolve(result);
          },
          then(resolve, reject) {
            return Promise.resolve(result).then(resolve, reject);
          },
        };
        return thenable;
      },
    };

    const snapshot = await loadCampaignSnapshot({ campaignId: "camp_04", supabase: fakeSupabase, fixture: null });

    expect(snapshot.campaign.ownerRole).toBe("Campaign Owner");
    expect(snapshot.campaign.updatedAt).toBe("2026-07-06T00:00:00.000Z");
    expect(snapshot.plan.campaignId).toBe("camp_04");
    expect(snapshot.workObjects[0]).toMatchObject({
      campaignId: "camp_04",
      ownerRole: "Campaign Owner",
      owner: "Campaign Owner",
    });
    expect(snapshot.contentRequirements[0]).toMatchObject({
      campaignId: "camp_04",
      assetType: "copy",
      source: "Content Planning matrix",
      compliance: "Requires brand, tone, and locale fit check before H2.",
      rolloutTarget: "Contentful",
      ownerRole: "Campaign Owner",
    });
    expect(snapshot.gateDecisions[0]).toMatchObject({
      campaignId: "camp_04",
      gateId: "H1",
      decision: "revision_requested",
      timestamp: "2026-07-06T00:00:03.000Z",
    });
    expect(snapshot.events[0]).toMatchObject({
      campaignId: "camp_04",
      timestamp: "2026-07-06T00:00:04.000Z",
    });
  });
});

describe("runtime action executor", () => {
  it("updates plan markets in fixture mode and records a revision", async () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const snapshot = createCampaignSnapshotFromFixture({
      run,
      plan,
      planningObjects: campaignPlanningObjectsFromPlan(plan),
      contentRequirements: contentRequirementsFromPlan(plan),
    });

    const result = await executeRuntimeAction({
      action: {
        action: "update_campaign_plan",
        targetId: "campaign-plan",
        note: "Update markets to China, Japan, and Australia.",
        payload: { markets: ["China", "Japan", "Australia"], locales: ["zh-CN", "ja-JP", "en-AU"] },
      },
      campaignId: run.campaignId,
      workspace: "campaign-planning",
      actor: "campaign-planning-specialist",
      fixtureSnapshot: snapshot,
    });

    expect(result.snapshot.plan.markets).toEqual(["China", "Japan", "Australia"]);
    expect(result.snapshot.plan.locales).toEqual(["zh-CN", "ja-JP", "en-AU"]);
    expect(result.revisions).toHaveLength(1);
    expect(result.events[0].type).toBe("object_patch");
  });
});
