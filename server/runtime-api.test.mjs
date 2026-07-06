import { describe, expect, it } from "vitest";
import { runtimeMode, canUseSupabase, createSupabaseServerClient } from "./supabase-client.mjs";
import { assertRuntimeStatus, normalizeWorkspace } from "./runtime-schema.mjs";
import { createCampaignSnapshotFromFixture, loadCampaignSnapshot } from "./campaign-runtime.mjs";
import { executeRuntimeAction } from "./object-runtime.mjs";
import {
  appendAgentMessage,
  appendAgentMessageToFixture,
  loadAgentHistory,
  loadAgentHistoryFromFixture,
  persistRuntimeEvent,
} from "./agent-runtime.mjs";
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

  it("updates a planning object status in fixture mode and records a revision", async () => {
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
        action: "update_planning_object",
        targetId: "campaign-objective",
        status: "revision-requested",
        note: "Tighten the objective before H1.",
        payload: { copy: "Reworked campaign objective copy." },
      },
      campaignId: run.campaignId,
      workspace: "campaign-planning",
      actor: "campaign-planning-specialist",
      fixtureSnapshot: snapshot,
    });

    expect(result.snapshot.workObjects.find((item) => item.id === "campaign-objective")).toMatchObject({
      status: "revision-requested",
      copy: "Reworked campaign objective copy.",
    });
    expect(result.revisions).toHaveLength(1);
    expect(result.events[0].payload.objectId).toBe("campaign-objective");
  });

  it("replaces content requirements in fixture mode and records the new list", async () => {
    const run = createDefaultRun();
    const plan = campaignPlanForRun(run);
    const snapshot = createCampaignSnapshotFromFixture({
      run,
      plan,
      planningObjects: campaignPlanningObjectsFromPlan(plan),
      contentRequirements: contentRequirementsFromPlan(plan),
    });

    const replacement = [
      {
        id: "content-requirement-a",
        channel: "Email",
        assetType: "copy",
        title: "New master email",
        locale: "de-DE",
        ownerRole: "Content / Creative",
        rolloutTarget: "SFMC",
        status: "approved",
        evidence: ["Updated matrix"],
      },
    ];

    const result = await executeRuntimeAction({
      action: {
        action: "update_content_requirements",
        note: "Replace the matrix with the trimmed H2 scope.",
        payload: { requirements: replacement },
      },
      campaignId: run.campaignId,
      workspace: "content-planning",
      actor: "content-planning-specialist",
      fixtureSnapshot: snapshot,
    });

    expect(result.snapshot.contentRequirements).toHaveLength(1);
    expect(result.snapshot.contentRequirements[0]).toMatchObject({
      id: "content-requirement-a",
      title: "New master email",
      status: "approved",
    });
    expect(result.revisions).toHaveLength(1);
    expect(result.events[0].payload.objectId).toBe("content-requirements");
  });

  it("deletes omitted content requirement rows before upserting a replacement set in Supabase mode", async () => {
    const run = createDefaultRun();
    const client = createFakeSupabaseClient({
      content_requirements: {
        select: [{ data: [{ id: "cr-1", campaign_id: run.campaignId }, { id: "cr-2", campaign_id: run.campaignId }], error: null }],
        delete: [{ data: null, error: null }],
        upsert: [{ data: null, error: null }],
        object_revisions: [{ data: null, error: null }],
        runtime_events: [{ data: null, error: null }],
      },
    });

    const replacement = [
      {
        id: "cr-1",
        channel: "Email",
        assetType: "copy",
        title: "Email master",
        locale: "de-DE",
        ownerRole: "Content / Creative",
        rolloutTarget: "SFMC",
        status: "approved",
        evidence: ["Replacement"],
      },
    ];

    const result = await executeRuntimeAction({
      action: {
        action: "update_content_requirements",
        note: "Trim the replacement matrix.",
        payload: { requirements: replacement },
      },
      campaignId: run.campaignId,
      workspace: "content-planning",
      actor: "content-planning-specialist",
      supabase: client.client,
    });

    expect(result.events).toHaveLength(1);
    expect(client.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "content_requirements",
          op: "delete",
          filters: [
            ["eq", "campaign_id", run.campaignId],
            ["in", "id", ["cr-2"]],
          ],
        }),
        expect.objectContaining({
          table: "content_requirements",
          op: "upsert",
          payload: expect.arrayContaining([expect.objectContaining({ id: "cr-1", status: "approved" })]),
        }),
      ]),
    );
  });

  it("deletes all content requirement rows when the replacement list is empty", async () => {
    const run = createDefaultRun();
    const client = createFakeSupabaseClient({
      content_requirements: {
        select: [{ data: [{ id: "cr-1", campaign_id: run.campaignId }], error: null }],
        delete: [{ data: null, error: null }],
        upsert: [{ data: null, error: null }],
        object_revisions: [{ data: null, error: null }],
        runtime_events: [{ data: null, error: null }],
      },
    });

    await executeRuntimeAction({
      action: {
        action: "update_content_requirements",
        note: "Clear the matrix.",
        payload: { requirements: [] },
      },
      campaignId: run.campaignId,
      workspace: "content-planning",
      actor: "content-planning-specialist",
      supabase: client.client,
    });

    expect(client.operations.some((entry) => entry.table === "content_requirements" && entry.op === "delete")).toBe(true);
    expect(client.operations.find((entry) => entry.table === "content_requirements" && entry.op === "delete").filters).toEqual([
      ["eq", "campaign_id", run.campaignId],
    ]);
  });

  it("persists top-level status on a single content requirement update in Supabase mode", async () => {
    const run = createDefaultRun();
    const client = createFakeSupabaseClient({
      content_requirements: {
        select: [{ data: { id: "cr-1", campaign_id: run.campaignId, status: "draft", title: "Old title" }, error: null }],
        update: [{ data: null, error: null }],
        object_revisions: [{ data: null, error: null }],
        runtime_events: [{ data: null, error: null }],
      },
    });

    await executeRuntimeAction({
      action: {
        action: "update_content_requirements",
        targetId: "cr-1",
        status: "approved",
        note: "Approve the requirement.",
        payload: { title: "New title" },
      },
      campaignId: run.campaignId,
      workspace: "content-planning",
      actor: "content-planning-specialist",
      supabase: client.client,
    });

    const updateOperation = client.operations.find((entry) => entry.table === "content_requirements" && entry.op === "update");
    expect(updateOperation.payload).toMatchObject({
      title: "New title",
      status: "approved",
    });
    const revisionOperation = client.operations.find((entry) => entry.table === "object_revisions" && entry.op === "insert");
    expect(revisionOperation.payload.after_data.status).toBe("approved");
  });

  it("rejects when persistence writes fail in Supabase mode", async () => {
    const run = createDefaultRun();
    const client = createFakeSupabaseClient({
      work_objects: {
        select: [{ data: { id: "campaign-objective", campaign_id: run.campaignId, status: "draft", title: "Objective" }, error: null }],
        update: [{ data: null, error: null }],
      },
      object_revisions: {
        insert: [{ data: null, error: new Error("revision write failed") }],
      },
      runtime_events: {
        insert: [{ data: null, error: null }],
      },
    });

    await expect(
      executeRuntimeAction({
        action: {
          action: "update_planning_object",
          targetId: "campaign-objective",
          status: "approved",
          note: "Approve the objective.",
          payload: { copy: "Final copy." },
        },
        campaignId: run.campaignId,
        workspace: "campaign-planning",
        actor: "campaign-planning-specialist",
        supabase: client.client,
      }),
    ).rejects.toThrow("revision write failed");
  });
});

describe("agent runtime messages", () => {
  it("keeps specialist history scoped by workspace", () => {
    const store = {};
    appendAgentMessageToFixture(store, {
      campaignId: "camp_04",
      workspace: "campaign-planning",
      agentId: "campaign-planning-specialist",
      role: "user",
      text: "update markets",
    });
    appendAgentMessageToFixture(store, {
      campaignId: "camp_04",
      workspace: "content",
      agentId: "content-specialist",
      role: "user",
      text: "revise copy",
    });

    expect(
      loadAgentHistoryFromFixture(store, {
        campaignId: "camp_04",
        workspace: "campaign-planning",
        agentId: "campaign-planning-specialist",
      }).map((m) => m.text),
    ).toEqual(["update markets"]);
  });

  it("creates an isolated thread per campaign, workspace, and agent in Supabase mode", async () => {
    const client = createFakeSupabaseClient({
      agent_threads: {
        select: [
          { data: null, error: null },
          { data: { id: 41, campaign_id: "camp_04", workspace: "campaign-planning", agent_id: "campaign-planning-specialist" }, error: null },
        ],
        insert: [{ data: { id: 41 }, error: null }],
      },
      agent_messages: {
        insert: [
          {
            data: {
              id: 100,
              thread_id: 41,
              role: "user",
              text: "update markets",
              model_mode: "deepseek",
              created_at: "2026-07-06T00:00:05.000Z",
            },
            error: null,
          },
        ],
        select: [
          {
            data: [
              { id: 101, thread_id: 41, role: "agent", text: "campaigns updated", model_mode: "deepseek", created_at: "2026-07-06T00:00:06.000Z" },
              { id: 100, thread_id: 41, role: "user", text: "update markets", model_mode: "deepseek", created_at: "2026-07-06T00:00:05.000Z" },
            ],
            error: null,
          },
        ],
      },
    });

    const message = await appendAgentMessage({
      campaignId: "camp_04",
      workspace: "campaign-planning",
      agentId: "campaign-planning-specialist",
      role: "user",
      text: "update markets",
      modelMode: "deepseek",
      supabase: client.client,
    });

    expect(message).toMatchObject({
      thread_id: 41,
      role: "user",
      text: "update markets",
      model_mode: "deepseek",
    });

    const history = await loadAgentHistory({
      campaignId: "camp_04",
      workspace: "campaign-planning",
      agentId: "campaign-planning-specialist",
      supabase: client.client,
      limit: 12,
    });

    expect(history.map((row) => row.text)).toEqual(["update markets", "campaigns updated"]);
    expect(client.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: "agent_threads",
          op: "select",
          filters: [
            ["eq", "campaign_id", "camp_04"],
            ["eq", "workspace", "campaign-planning"],
            ["eq", "agent_id", "campaign-planning-specialist"],
          ],
        }),
        expect.objectContaining({
          table: "agent_threads",
          op: "insert",
          payload: expect.objectContaining({
            campaign_id: "camp_04",
            workspace: "campaign-planning",
            agent_id: "campaign-planning-specialist",
            visible_to_workspace: true,
            owner_id: null,
          }),
        }),
        expect.objectContaining({
          table: "agent_messages",
          op: "insert",
          payload: expect.objectContaining({
            thread_id: 41,
            role: "user",
            text: "update markets",
            model_mode: "deepseek",
            owner_id: null,
          }),
        }),
      ]),
    );
  });

  it("persists runtime events with lowercase runtime columns", async () => {
    const client = createFakeSupabaseClient({
      runtime_events: {
        insert: [{ data: null, error: null }],
      },
    });

    await persistRuntimeEvent({
      event: {
        id: "agent_message_01",
        campaignId: "camp_04",
        workspace: "campaign-planning",
        type: "agent_message",
        actor: "campaign-planning-specialist",
        ownerId: "user-01",
        payload: { text: "update markets" },
        timestamp: "2026-07-06T00:00:07.000Z",
      },
      supabase: client.client,
    });

    expect(client.operations).toEqual([
      expect.objectContaining({
        table: "runtime_events",
        op: "insert",
        payload: {
          id: "agent_message_01",
          campaign_id: "camp_04",
          workspace: "campaign-planning",
          type: "agent_message",
          actor: "campaign-planning-specialist",
          owner_id: "user-01",
          payload: { text: "update markets" },
          created_at: "2026-07-06T00:00:07.000Z",
        },
      }),
    ]);
  });
});

function createFakeSupabaseClient(scripts = {}) {
  const operations = [];
  const tables = new Map(Object.entries(scripts));

  const client = {
    from(table) {
      return createFakeQueryBuilder({ table, operations, scripts: tables });
    },
  };

  return { client, operations };
}

function createFakeQueryBuilder({ table, operations, scripts }) {
  const query = {
    table,
    op: "select",
    filters: [],
    payload: undefined,
    options: undefined,
  };

  const builder = {
    select(columns = "*") {
      query.columns = columns;
      return builder;
    },
    insert(payload) {
      query.op = "insert";
      query.payload = payload;
      return builder;
    },
    update(payload) {
      query.op = "update";
      query.payload = payload;
      return builder;
    },
    delete() {
      query.op = "delete";
      return builder;
    },
    upsert(payload, options) {
      query.op = "upsert";
      query.payload = payload;
      query.options = options;
      return builder;
    },
    eq(column, value) {
      query.filters.push(["eq", column, value]);
      return builder;
    },
    in(column, values) {
      query.filters.push(["in", column, values]);
      return builder;
    },
    order(column, options) {
      query.order = [column, options];
      return builder;
    },
    limit(value) {
      query.limit = value;
      return builder;
    },
    single() {
      operations.push(snapshotOperation(query));
      return Promise.resolve(resolveScriptResult({ table, op: query.op, scripts }));
    },
    maybeSingle() {
      operations.push(snapshotOperation(query));
      return Promise.resolve(resolveScriptResult({ table, op: query.op, scripts }));
    },
    then(resolve, reject) {
      operations.push(snapshotOperation(query));
      return Promise.resolve(resolveScriptResult({ table, op: query.op, scripts })).then(resolve, reject);
    },
  };

  return builder;
}

function resolveScriptResult({ table, op, scripts }) {
  const tableScripts = scripts.get(table) || {};
  const queue = tableScripts[op] || [];
  const next = queue.length ? queue.shift() : { data: null, error: null };
  tableScripts[op] = queue;
  scripts.set(table, tableScripts);
  return next;
}

function snapshotOperation(query) {
  return {
    table: query.table,
    op: query.op,
    filters: query.filters.map((filter) => [...filter]),
    payload: cloneValue(query.payload),
    options: cloneValue(query.options),
    columns: query.columns,
    order: cloneValue(query.order),
    limit: query.limit,
  };
}

function cloneValue(value) {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
}
