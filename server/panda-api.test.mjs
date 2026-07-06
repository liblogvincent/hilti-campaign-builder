import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { handleAgent, handleHealth, handleIntegrationPackage, handleOrchestrator, normalizeOrchestratorResponse } from "./panda-api.mjs";
import * as aiTransport from "./ai-transport.mjs";
import { callJsonAgent, resolveProviderConfig, parseJsonObject } from "./ai-transport.mjs";
import { getAgentDefinition } from "./agent-registry.mjs";
import { createAgentMessageEvent, createGateDecisionEvent, createObjectPatchEvent, createRuntimeEvent } from "./runtime-events.mjs";
import { canUseSupabase, runtimeMode } from "./supabase-client.mjs";

const { generateTextMock, createOpenAiMock, createClientMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(async () => ({ text: '{"answer":"from-sdk"}' })),
  createOpenAiMock: vi.fn((options) => {
    const provider = vi.fn(() => {
      throw new Error("provider callable surface should not be used");
    });
    provider.options = options;
    provider.chat = vi.fn((name) => `mock-chat:${name}`);
    return provider;
  }),
  createClientMock: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: generateTextMock,
}));

vi.mock("@ai-sdk/openai", () => ({
  createOpenAI: createOpenAiMock,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createClientMock,
}));

describe("ai transport", () => {
  it("uses fixture mode when no provider key is available", () => {
    const config = resolveProviderConfig({});
    expect(config.mode).toBe("fixture");
    expect(config.transport).toBe("fixture");
  });

  it("extracts JSON from a model response with surrounding text", () => {
    expect(parseJsonObject("Here is JSON {\"answer\":\"ok\"}", { answer: "fallback" })).toEqual({ answer: "ok" });
  });

  it("falls back safely when JSON is malformed", () => {
    expect(parseJsonObject("not json", { answer: "fallback" })).toEqual({ answer: "fallback" });
  });

  it("defaults to OpenAI-style baseUrl and model when DEEPSEEK_API_STYLE is unset", () => {
    const config = resolveProviderConfig({ DEEPSEEK_API_KEY: "sk-test" });
    expect(config.mode).toBe("deepseek");
    expect(config.style).toBe("openai");
    expect(config.baseUrl).toBe("https://api.deepseek.com");
    expect(config.model).toBe("deepseek-chat");
  });

  it("defaults to OpenAI-style baseUrl and model when DEEPSEEK_API_STYLE is openai", () => {
    const config = resolveProviderConfig({ DEEPSEEK_API_KEY: "sk-test", DEEPSEEK_API_STYLE: "openai" });
    expect(config.mode).toBe("deepseek");
    expect(config.style).toBe("openai");
    expect(config.baseUrl).toBe("https://api.deepseek.com");
    expect(config.model).toBe("deepseek-chat");
  });

  it("defaults to Anthropic-style baseUrl and model when DEEPSEEK_API_STYLE is anthropic", () => {
    const config = resolveProviderConfig({ DEEPSEEK_API_KEY: "sk-test", DEEPSEEK_API_STYLE: "anthropic" });
    expect(config.mode).toBe("deepseek");
    expect(config.style).toBe("anthropic");
    expect(config.baseUrl).toBe("https://api.deepseek.com/anthropic");
    expect(config.model).toBe("deepseek-v4-flash");
  });

  it("selects Vercel AI SDK transport when configured", () => {
    const config = resolveProviderConfig({
      PANDA_AI_TRANSPORT: "vercel-ai",
      DEEPSEEK_API_KEY: "sk-test",
      DEEPSEEK_BASE_URL: "https://api.deepseek.com",
      DEEPSEEK_MODEL: "deepseek-chat",
    });

    expect(config.mode).toBe("deepseek");
    expect(config.transport).toBe("vercel-ai");
  });

  it("uses the Vercel AI SDK path when transport is vercel-ai", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const fetchImpl = vi.fn(async () => {
      throw new Error("fetch path should not be used");
    });

    const result = await callJsonAgent({
      payload: { phase: "planning" },
      systemPrompt: "Test prompt",
      fallback: { answer: "fallback" },
      normalize: (data, _payload, mode) => ({ mode, ...data, transport: "vercel-ai" }),
      env: {
        PANDA_AI_TRANSPORT: "vercel-ai",
        DEEPSEEK_API_KEY: "sk-test",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-chat",
      },
      fetchImpl,
    });

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 20000);
    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(createOpenAiMock).toHaveBeenCalledWith({
      apiKey: "sk-test",
      baseURL: "https://api.deepseek.com/v1",
    });
    const provider = createOpenAiMock.mock.results[0].value;
    expect(provider).not.toHaveBeenCalled();
    expect(provider.chat).toHaveBeenCalledWith("deepseek-chat");
    expect(generateTextMock).toHaveBeenCalledWith(expect.objectContaining({
      model: "mock-chat:deepseek-chat",
      system: "Test prompt",
      prompt: JSON.stringify({ phase: "planning" }),
      temperature: 0.2,
      abortSignal: expect.any(AbortSignal),
    }));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      mode: "deepseek",
      answer: "from-sdk",
      transport: "vercel-ai",
    });

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("falls back safely when the Vercel AI SDK call fails", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("sdk exploded"));

    await expect(callJsonAgent({
      payload: { phase: "planning" },
      systemPrompt: "Test prompt",
      fallback: { answer: "fallback" },
      normalize: (data, _payload, mode) => ({ mode, ...data }),
      env: {
        PANDA_AI_TRANSPORT: "vercel-ai",
        DEEPSEEK_API_KEY: "sk-test",
        DEEPSEEK_BASE_URL: "https://api.deepseek.com",
        DEEPSEEK_MODEL: "deepseek-chat",
      },
    })).resolves.toEqual({
      mode: "fixture",
      answer: "fallback",
      warning: "DeepSeek Vercel AI SDK transport failed: sdk exploded",
    });
  });

  it("allows explicit overrides for baseUrl and model regardless of style", () => {
    const config = resolveProviderConfig({
      DEEPSEEK_API_KEY: "sk-test",
      DEEPSEEK_API_STYLE: "anthropic",
      DEEPSEEK_BASE_URL: "https://custom.example.com",
      DEEPSEEK_MODEL: "custom-model",
    });
    expect(config.style).toBe("anthropic");
    expect(config.baseUrl).toBe("https://custom.example.com");
    expect(config.model).toBe("custom-model");
  });

  it("warns when the provider ok response contains malformed JSON", async () => {
    const fakeFetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "not json" } }],
      }),
    });

    const fallback = { gate: { id: "H1" }, artifacts: [] };
    const result = await callJsonAgent({
      payload: { phase: "planning" },
      systemPrompt: "Test prompt",
      fallback,
      normalize: (data, _payload, mode) => ({ mode, ...data }),
      env: { DEEPSEEK_API_KEY: "sk-test" },
      fetchImpl: fakeFetch,
    });

    expect(result.warning).toBe(
      "DeepSeek returned malformed JSON; Panda normalized it into a safe gate packet.",
    );
  });
});

describe("runtime mode boundary", () => {
  it("falls back to local when supabase is selected without credentials", () => {
    expect(runtimeMode({ PANDA_RUNTIME_MODE: "supabase" })).toBe("local");
  });

  it("uses supabase mode when explicitly configured", () => {
    const env = {
      PANDA_RUNTIME_MODE: "supabase",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-role",
    };

    expect(runtimeMode(env)).toBe("supabase");
    expect(canUseSupabase(env)).toBe(true);
  });
});

describe("agent registry", () => {
  it("routes home to the orchestrator definition", () => {
    const agent = getAgentDefinition({ id: "home-orchestrator", view: "home" });
    expect(agent.id).toBe("home-orchestrator");
    expect(agent.allowedActions).toContain("ask_brief_question");
  });

  it("routes content planning to its specialist definition", () => {
    const agent = getAgentDefinition({ id: "content-planning-specialist", view: "content-planning" });
    expect(agent.id).toBe("content-planning-specialist");
    expect(agent.allowedActions).toContain("update_content_requirements");
  });

  it("resolves by role field from client agent scope", () => {
    const agent = getAgentDefinition({ role: "rollout-specialist", surface: "rollout" });
    expect(agent.id).toBe("rollout-specialist");
  });

  it("resolves by view when id and role are missing", () => {
    const agent = getAgentDefinition({ view: "optimize" });
    expect(agent.id).toBe("optimize-specialist");
  });

  it("falls back to home orchestrator for unknown scope", () => {
    const agent = getAgentDefinition({ id: "nonexistent", view: "unknown" });
    expect(agent.id).toBe("home-orchestrator");
  });

  it("returns home orchestrator when scope is null or undefined", () => {
    expect(getAgentDefinition(null).id).toBe("home-orchestrator");
    expect(getAgentDefinition(undefined).id).toBe("home-orchestrator");
  });

  it("builds a system prompt for every registered agent", () => {
    for (const id of [
      "home-orchestrator",
      "campaign-planning-specialist",
      "content-planning-specialist",
      "content-specialist",
      "rollout-specialist",
      "optimize-specialist",
    ]) {
      const agent = getAgentDefinition({ id });
      expect(agent.systemPrompt).toBeTruthy();
      expect(typeof agent.systemPrompt).toBe("string");
      expect(agent.systemPrompt.length).toBeGreaterThan(50);
    }
  });

  it("every agent system prompt forbids auto-publish", () => {
    for (const id of [
      "home-orchestrator",
      "campaign-planning-specialist",
      "content-planning-specialist",
      "content-specialist",
      "rollout-specialist",
      "optimize-specialist",
    ]) {
      const agent = getAgentDefinition({ id });
      expect(agent.systemPrompt).toMatch(/do not|forbidden|cannot|denied|never|no auto/i);
    }
  });
});

describe("panda api handlers", () => {
  it("reports health without requiring the local dev server", async () => {
    const res = createResponse();

    await handleHealth(createRequest("GET"), res);

    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, deepseek: Boolean(process.env.DEEPSEEK_API_KEY) });
  });

  it("returns a fixture agent packet when DeepSeek is not configured", async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const res = createResponse();

    await handleAgent(createRequest("POST", { phase: "planning", campaign_id: "camp_test" }), res);

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.mode).toBe("fixture");
    expect(body.gate.id).toBe("H1");
    expect(body.artifacts.some((artifact) => artifact.type === "campaign-plan.v3")).toBe(true);
    restoreEnvKey("DEEPSEEK_API_KEY", originalKey);
  });

  it("returns an orchestrator fixture answer from the serverless handler", async () => {
    const originalKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    const res = createResponse();

    await handleOrchestrator(createRequest("POST", { question: "What is missing before H2?", phase: "content" }), res);

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.mode).toBe("fixture");
    expect(body.answer).toContain("H2");
    restoreEnvKey("DEEPSEEK_API_KEY", originalKey);
  });

  it("keeps fixture orchestrator behavior when runtime mode is local", async () => {
    const originalRuntimeMode = process.env.PANDA_RUNTIME_MODE;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const originalDeepseekKey = process.env.DEEPSEEK_API_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.PANDA_RUNTIME_MODE = "local";
    delete process.env.DEEPSEEK_API_KEY;

    const req = createRequest("POST", {
      campaign_id: "camp_04",
      question: "update markets to China, Japan, Australia",
      agent_scope: { id: "campaign-planning-specialist", view: "campaign-planning" },
    });
    const res = createResponse();
    await handleOrchestrator(req, res);
    const body = JSON.parse(res.body);

    expect(body.answer).toBeTruthy();
    expect(body.mode).toBeTruthy();

    restoreEnvKey("DEEPSEEK_API_KEY", originalDeepseekKey);
    restoreEnvKey("PANDA_RUNTIME_MODE", originalRuntimeMode);
    restoreEnvKey("SUPABASE_URL", originalSupabaseUrl);
    restoreEnvKey("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
  });

  it("persists a phase packet turn when Supabase runtime is enabled", async () => {
    const client = createFakeSupabaseClient({
      rpc: {
        persist_agent_turn: [
          {
            data: {
              thread_id: 41,
              user_message_id: 100,
              agent_message_id: 101,
              runtime_event_id: "agent_message_01",
            },
            error: null,
          },
        ],
      },
    });
    createClientMock.mockReset();
    createClientMock.mockReturnValue(client.client);

    const originalRuntimeMode = process.env.PANDA_RUNTIME_MODE;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.PANDA_RUNTIME_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.DEEPSEEK_API_KEY;

    const res = createResponse();
    await handleAgent(createRequest("POST", { phase: "planning", campaign_id: "camp_04", instruction: "Create the next gate-ready artifact packet." }), res);

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.mode).toBe("fixture");
    expect(body.summary).toBeTruthy();
    expect(client.operations).toEqual([
      expect.objectContaining({
        kind: "rpc",
        fn: "persist_agent_turn",
        args: {
          p_campaign_id: "camp_04",
          p_workspace: "campaign-planning",
          p_agent_id: "home-orchestrator",
          p_user_text: "Create the next gate-ready artifact packet.",
          p_answer_text: body.summary,
          p_model_mode: "fixture",
        },
      }),
    ]);

    restoreEnvKey("PANDA_RUNTIME_MODE", originalRuntimeMode);
    restoreEnvKey("SUPABASE_URL", originalSupabaseUrl);
    restoreEnvKey("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
  });

  it("persists a scoped orchestrator turn when Supabase runtime is enabled", async () => {
    const client = createFakeSupabaseClient({
      rpc: {
        persist_agent_turn: [
          {
            data: {
              thread_id: 51,
              user_message_id: 201,
              agent_message_id: 202,
              runtime_event_id: "agent_message_02",
            },
            error: null,
          },
        ],
      },
    });
    createClientMock.mockReset();
    createClientMock.mockReturnValue(client.client);

    const originalRuntimeMode = process.env.PANDA_RUNTIME_MODE;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.PANDA_RUNTIME_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.DEEPSEEK_API_KEY;

    const res = createResponse();
    await handleOrchestrator(
      createRequest("POST", {
        campaign_id: "camp_04",
        question: "What is missing before H2?",
        agent_scope: { id: "campaign-planning-specialist", view: "campaign-planning" },
      }),
      res,
    );

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.mode).toBe("fixture");
    expect(body.answer).toBeTruthy();
    expect(client.operations).toEqual([
      expect.objectContaining({
        kind: "rpc",
        fn: "persist_agent_turn",
        args: {
          p_campaign_id: "camp_04",
          p_workspace: "campaign-planning",
          p_agent_id: "campaign-planning-specialist",
          p_user_text: "What is missing before H2?",
          p_answer_text: body.answer,
          p_model_mode: "fixture",
        },
      }),
    ]);

    restoreEnvKey("PANDA_RUNTIME_MODE", originalRuntimeMode);
    restoreEnvKey("SUPABASE_URL", originalSupabaseUrl);
    restoreEnvKey("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
  });

  it("executes campaign plan updates through Supabase runtime actions", async () => {
    const client = createFakeSupabaseClient({
      campaigns: {
        select: [
          {
            data: {
              id: "camp_04",
              name: "Fixture Campaign",
              brief: "Plan a campaign",
              phase: "planning",
              active_gate: "H1",
              owner_role: "Campaign Owner",
              updated_at: "2026-07-06T00:00:00.000Z",
            },
            error: null,
          },
        ],
      },
      campaign_plans: {
        select: [
          {
            data: [
              {
                id: 11,
                campaign_id: "camp_04",
                version: 1,
                name: "Initial plan",
                hero_product: "Initial product",
                markets: ["Germany"],
                locales: ["de-DE"],
                audience: ["Contractors"],
                budget: "EUR 10k",
                timeline: "Draft",
                channels: [],
                kpis: [],
                assumptions: [],
              },
            ],
            error: null,
          },
          {
            data: [
              {
                id: 11,
                campaign_id: "camp_04",
                version: 2,
                name: "Initial plan",
                hero_product: "Initial product",
                markets: ["China", "Japan", "Australia"],
                locales: ["zh-CN", "ja-JP", "en-AU"],
                audience: ["Contractors"],
                budget: "EUR 10k",
                timeline: "Draft",
                channels: [],
                kpis: [],
                assumptions: [],
              },
            ],
            error: null,
          },
        ],
        insert: [{ data: null, error: null }],
      },
      work_objects: {
        select: [
          {
            data: [
              {
                id: "campaign-objective",
                campaign_id: "camp_04",
                workspace: "campaign-planning",
                title: "Campaign Objective",
                lane: "Strategy",
                owner_role: "Campaign Owner",
                status: "draft",
                gate: "H1",
                copy: "Initial objective",
                evidence: [],
                source: "CampaignPlan",
                updated_by: "seed",
                updated_at: "2026-07-06T00:00:00.000Z",
              },
            ],
            error: null,
          },
          {
            data: [
              {
                id: "campaign-objective",
                campaign_id: "camp_04",
                workspace: "campaign-planning",
                title: "Campaign Objective",
                lane: "Strategy",
                owner_role: "Campaign Owner",
                status: "draft",
                gate: "H1",
                copy: "Initial objective",
                evidence: [],
                source: "CampaignPlan",
                updated_by: "seed",
                updated_at: "2026-07-06T00:00:00.000Z",
              },
            ],
            error: null,
          },
        ],
        update: [{ data: null, error: null }],
      },
      content_requirements: {
        select: [
          {
            data: [],
            error: null,
          },
        ],
      },
      gate_decisions: {
        select: [
          {
            data: [],
            error: null,
          },
        ],
      },
      runtime_events: {
        insert: [{ data: null, error: null }],
        select: [
          {
            data: [
              {
                id: "agent_message_03",
                campaign_id: "camp_04",
                workspace: "campaign-planning",
                type: "object_patch",
                actor: "campaign-planning-specialist",
                payload: { objectId: "campaign-plan" },
                created_at: "2026-07-06T00:00:01.000Z",
              },
            ],
            error: null,
          },
        ],
      },
      object_revisions: {
        insert: [{ data: null, error: null }],
      },
      rpc: {
        persist_agent_turn: [
          {
            data: {
              thread_id: 71,
              user_message_id: 301,
              agent_message_id: 302,
              runtime_event_id: "agent_message_03",
            },
            error: null,
          },
        ],
      },
    });
    createClientMock.mockReset();
    createClientMock.mockReturnValue(client.client);

    const callJsonAgentSpy = vi.spyOn(aiTransport, "callJsonAgent").mockResolvedValueOnce({
      mode: "deepseek",
      answer: "Plan updated.",
      highlights: ["Campaign markets changed"],
      suggested_actions: ["Review the updated plan"],
      route: "Campaign Planning",
      updates: [
        {
          action: "update_campaign_plan",
          note: "Expand the plan to China, Japan, and Australia.",
          payload: { markets: ["China", "Japan", "Australia"], locales: ["zh-CN", "ja-JP", "en-AU"] },
        },
      ],
    });

    const originalRuntimeMode = process.env.PANDA_RUNTIME_MODE;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.PANDA_RUNTIME_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.DEEPSEEK_API_KEY;

    const res = createResponse();
    await handleOrchestrator(
      createRequest("POST", {
        campaign_id: "camp_04",
        question: "Update the campaign plan for APAC expansion.",
        agent_scope: { id: "campaign-planning-specialist", view: "campaign-planning" },
      }),
      res,
    );

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.mode).toBe("deepseek");
    expect(body.updates).toEqual([
      expect.objectContaining({
        action: "update_campaign_plan",
      }),
    ]);
    expect(body.events).toHaveLength(1);
    expect(body.events[0]).toMatchObject({
      type: "object_patch",
      actor: "campaign-planning-specialist",
    });
    expect(body.snapshot).toBeTruthy();
    expect(body.snapshot.plan.markets).toEqual(["China", "Japan", "Australia"]);
    expect(body.snapshot.plan.locales).toEqual(["zh-CN", "ja-JP", "en-AU"]);
    expect(client.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "rpc",
          fn: "persist_agent_turn",
        }),
        expect.objectContaining({
          table: "campaign_plans",
          op: "select",
          filters: [
            ["eq", "campaign_id", "camp_04"],
          ],
        }),
        expect.objectContaining({
          table: "campaign_plans",
          op: "insert",
          payload: expect.objectContaining({
            campaign_id: "camp_04",
            version: 2,
            updated_by: "campaign-planning-specialist",
          }),
        }),
        expect.objectContaining({
          table: "object_revisions",
          op: "insert",
        }),
        expect.objectContaining({
          table: "runtime_events",
          op: "insert",
        }),
      ]),
    );

    callJsonAgentSpy.mockRestore();
    restoreEnvKey("PANDA_RUNTIME_MODE", originalRuntimeMode);
    restoreEnvKey("SUPABASE_URL", originalSupabaseUrl);
    restoreEnvKey("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
  });

  it("signals partial success when a later orchestrator update fails after earlier commits", async () => {
    const client = createFakeSupabaseClient({
      campaigns: {
        select: [
          {
            data: {
              id: "camp_04",
              name: "Fixture Campaign",
              brief: "Plan a campaign",
              phase: "planning",
              active_gate: "H1",
              owner_role: "Campaign Owner",
              updated_at: "2026-07-06T00:00:00.000Z",
            },
            error: null,
          },
        ],
      },
      campaign_plans: {
        select: [
          {
            data: [
              {
                id: 11,
                campaign_id: "camp_04",
                version: 1,
                name: "Initial plan",
                hero_product: "Initial product",
                markets: ["Germany"],
                locales: ["de-DE"],
                audience: ["Contractors"],
                budget: "EUR 10k",
                timeline: "Draft",
                channels: [],
                kpis: [],
                assumptions: [],
              },
            ],
            error: null,
          },
          {
            data: [
              {
                id: 11,
                campaign_id: "camp_04",
                version: 2,
                name: "Initial plan",
                hero_product: "Initial product",
                markets: ["China", "Japan", "Australia"],
                locales: ["zh-CN", "ja-JP", "en-AU"],
                audience: ["Contractors"],
                budget: "EUR 10k",
                timeline: "Draft",
                channels: [],
                kpis: [],
                assumptions: [],
              },
            ],
            error: null,
          },
        ],
        insert: [{ data: null, error: null }],
      },
      work_objects: {
        select: [
          {
            data: [
              {
                id: "campaign-objective",
                campaign_id: "camp_04",
                workspace: "campaign-planning",
                title: "Campaign Objective",
                lane: "Strategy",
                owner_role: "Campaign Owner",
                status: "draft",
                gate: "H1",
                copy: "Initial objective",
                evidence: [],
                source: "CampaignPlan",
                updated_by: "seed",
                updated_at: "2026-07-06T00:00:00.000Z",
              },
            ],
            error: null,
          },
          {
            data: [
              {
                id: "campaign-objective",
                campaign_id: "camp_04",
                workspace: "campaign-planning",
                title: "Campaign Objective",
                lane: "Strategy",
                owner_role: "Campaign Owner",
                status: "draft",
                gate: "H1",
                copy: "Initial objective",
                evidence: [],
                source: "CampaignPlan",
                updated_by: "seed",
                updated_at: "2026-07-06T00:00:00.000Z",
              },
            ],
            error: null,
          },
        ],
        update: [{ data: null, error: new Error("work object write failed") }],
      },
      content_requirements: {
        select: [{ data: [], error: null }],
      },
      gate_decisions: {
        select: [{ data: [], error: null }],
      },
      runtime_events: {
        insert: [{ data: null, error: null }],
        select: [{ data: [], error: null }],
      },
      object_revisions: {
        insert: [{ data: null, error: null }],
      },
      rpc: {
        persist_agent_turn: [
          {
            data: {
              thread_id: 71,
              user_message_id: 301,
              agent_message_id: 302,
              runtime_event_id: "agent_message_03",
            },
            error: null,
          },
        ],
      },
    });
    createClientMock.mockReset();
    createClientMock.mockReturnValue(client.client);

    const callJsonAgentSpy = vi.spyOn(aiTransport, "callJsonAgent").mockResolvedValueOnce({
      mode: "deepseek",
      answer: "Plan updated.",
      highlights: ["Campaign markets changed"],
      suggested_actions: ["Review the updated plan"],
      route: "Campaign Planning",
      updates: [
        {
          action: "update_campaign_plan",
          note: "Expand the plan to China, Japan, and Australia.",
          payload: { markets: ["China", "Japan", "Australia"], locales: ["zh-CN", "ja-JP", "en-AU"] },
        },
        {
          action: "update_planning_object",
          targetId: "campaign-objective",
          note: "Tighten the campaign objective.",
          status: "revision-requested",
          payload: { copy: "Updated objective" },
        },
      ],
    });

    const originalRuntimeMode = process.env.PANDA_RUNTIME_MODE;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const originalDeepseekKey = process.env.DEEPSEEK_API_KEY;
    process.env.PANDA_RUNTIME_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.DEEPSEEK_API_KEY;

    const res = createResponse();
    await handleOrchestrator(
      createRequest("POST", {
        campaign_id: "camp_04",
        question: "Update the campaign plan for APAC expansion.",
        agent_scope: { id: "campaign-planning-specialist", view: "campaign-planning" },
      }),
      res,
    );

    const body = JSON.parse(res.body);
    expect(res.status).toBe(503);
    expect(body.partial).toBe(true);
    expect(body.events).toHaveLength(1);
    expect(body.committed_update_count).toBe(1);
    expect(body.failed_update_action).toBe("update_planning_object");
    expect(body.retry).toMatchObject({
      campaign_id: "camp_04",
      workspace: "campaign-planning",
      actor: "campaign-planning-specialist",
      pending_actions: ["update_planning_object"],
    });
    expect(body.snapshot.plan.markets).toEqual(["China", "Japan", "Australia"]);

    callJsonAgentSpy.mockRestore();
    restoreEnvKey("DEEPSEEK_API_KEY", originalDeepseekKey);
    restoreEnvKey("PANDA_RUNTIME_MODE", originalRuntimeMode);
    restoreEnvKey("SUPABASE_URL", originalSupabaseUrl);
    restoreEnvKey("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
  });

  it("returns committed events when snapshot refresh fails after orchestrator updates commit", async () => {
    const client = createFakeSupabaseClient({
      campaigns: {
        select: [{ data: null, error: new Error("snapshot unavailable") }],
      },
      campaign_plans: {
        select: [
          {
            data: [
              {
                id: 11,
                campaign_id: "camp_04",
                version: 1,
                name: "Initial plan",
                hero_product: "Initial product",
                markets: ["Germany"],
                locales: ["de-DE"],
                audience: ["Contractors"],
                budget: "EUR 10k",
                timeline: "Draft",
                channels: [],
                kpis: [],
                assumptions: [],
              },
            ],
            error: null,
          },
        ],
        insert: [{ data: null, error: null }],
      },
      runtime_events: {
        insert: [{ data: null, error: null }],
      },
      object_revisions: {
        insert: [{ data: null, error: null }],
      },
      rpc: {
        persist_agent_turn: [
          {
            data: {
              thread_id: 71,
              user_message_id: 301,
              agent_message_id: 302,
              runtime_event_id: "agent_message_03",
            },
            error: null,
          },
        ],
      },
    });
    createClientMock.mockReset();
    createClientMock.mockReturnValue(client.client);

    const callJsonAgentSpy = vi.spyOn(aiTransport, "callJsonAgent").mockResolvedValueOnce({
      mode: "deepseek",
      answer: "Plan updated.",
      highlights: ["Campaign markets changed"],
      suggested_actions: ["Review the updated plan"],
      route: "Campaign Planning",
      updates: [
        {
          action: "update_campaign_plan",
          note: "Expand the plan to China, Japan, and Australia.",
          payload: { markets: ["China", "Japan", "Australia"], locales: ["zh-CN", "ja-JP", "en-AU"] },
        },
      ],
    });

    const originalRuntimeMode = process.env.PANDA_RUNTIME_MODE;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const originalDeepseekKey = process.env.DEEPSEEK_API_KEY;
    process.env.PANDA_RUNTIME_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.DEEPSEEK_API_KEY;

    const res = createResponse();
    await handleOrchestrator(
      createRequest("POST", {
        campaign_id: "camp_04",
        question: "Update the campaign plan for APAC expansion.",
        agent_scope: { id: "campaign-planning-specialist", view: "campaign-planning" },
      }),
      res,
    );

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.updates).toEqual([]);
    expect(body.events).toHaveLength(1);
    expect(body.snapshot).toBeUndefined();
    expect(body.snapshot_status).toBe("unavailable_after_commit");
    expect(body.no_replay).toBe(true);
    expect(body.committed_update_count).toBe(1);
    expect(body.warning).toContain("updates committed");
    expect(body.warning).toContain("snapshot unavailable");
    expect(body.failed_update_action).toBeUndefined();
    expect(body.retry).toBeUndefined();

    callJsonAgentSpy.mockRestore();
    restoreEnvKey("DEEPSEEK_API_KEY", originalDeepseekKey);
    restoreEnvKey("PANDA_RUNTIME_MODE", originalRuntimeMode);
    restoreEnvKey("SUPABASE_URL", originalSupabaseUrl);
    restoreEnvKey("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
  });

  it("returns a persistence failure when Supabase RPC fails for agent turns", async () => {
    const client = createFakeSupabaseClient({
      rpc: {
        persist_agent_turn: [
          {
            data: null,
            error: new Error("rpc write failed"),
          },
        ],
      },
    });
    createClientMock.mockReset();
    createClientMock.mockReturnValue(client.client);

    const originalRuntimeMode = process.env.PANDA_RUNTIME_MODE;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.PANDA_RUNTIME_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.DEEPSEEK_API_KEY;

    const res = createResponse();
    await handleAgent(createRequest("POST", { phase: "planning", campaign_id: "camp_04", instruction: "Create the next gate-ready artifact packet." }), res);

    const body = JSON.parse(res.body);
    expect(res.status).toBe(503);
    expect(body).toEqual({
      error: "Durable runtime persistence failed",
      details: "rpc write failed",
    });
    expect(client.operations).toEqual([
      expect.objectContaining({
        kind: "rpc",
        fn: "persist_agent_turn",
      }),
    ]);

    restoreEnvKey("PANDA_RUNTIME_MODE", originalRuntimeMode);
    restoreEnvKey("SUPABASE_URL", originalSupabaseUrl);
    restoreEnvKey("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
  });

  it("returns a persistence failure when Supabase RPC fails for orchestrator turns", async () => {
    const client = createFakeSupabaseClient({
      rpc: {
        persist_agent_turn: [
          {
            data: null,
            error: new Error("rpc write failed"),
          },
        ],
      },
    });
    createClientMock.mockReset();
    createClientMock.mockReturnValue(client.client);

    const originalRuntimeMode = process.env.PANDA_RUNTIME_MODE;
    const originalSupabaseUrl = process.env.SUPABASE_URL;
    const originalSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.PANDA_RUNTIME_MODE = "supabase";
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    delete process.env.DEEPSEEK_API_KEY;

    const res = createResponse();
    await handleOrchestrator(
      createRequest("POST", {
        campaign_id: "camp_04",
        question: "What is missing before H2?",
        agent_scope: { id: "campaign-planning-specialist", view: "campaign-planning" },
      }),
      res,
    );

    const body = JSON.parse(res.body);
    expect(res.status).toBe(503);
    expect(body).toEqual({
      error: "Durable runtime persistence failed",
      details: "rpc write failed",
    });
    expect(client.operations).toEqual([
      expect.objectContaining({
        kind: "rpc",
        fn: "persist_agent_turn",
      }),
    ]);

    restoreEnvKey("PANDA_RUNTIME_MODE", originalRuntimeMode);
    restoreEnvKey("SUPABASE_URL", originalSupabaseUrl);
    restoreEnvKey("SUPABASE_SERVICE_ROLE_KEY", originalSupabaseKey);
  });

  it("builds integration packages from the serverless handler", async () => {
    const res = createResponse();

    await handleIntegrationPackage(createRequest("POST", { campaign_id: "camp_test" }), res);

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.artifacts.some((artifact) => artifact.type === "publish-manifest")).toBe(true);
  });
});

describe("orchestrator response normalization", () => {
  const basePayload = { question: "test", phase: "planning" };

  it("normalizes valid specialist updates", () => {
    const result = normalizeOrchestratorResponse(
      {
        answer: "Updated.",
        updates: [
          { action: "update_content_requirements", note: "Add MOCN-only content.", payload: { audience: "MOCN" } },
        ],
      },
      basePayload,
      "deepseek",
    );
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0]).toEqual({
      action: "update_content_requirements",
      note: "Add MOCN-only content.",
      targetId: undefined,
      status: undefined,
      payload: { audience: "MOCN" },
    });
  });

  it("removes updates with disallowed actions", () => {
    const result = normalizeOrchestratorResponse(
      {
        answer: "Nope.",
        updates: [
          { action: "approve_gate", note: "Approve H1" },
          { action: "update_planning_object", note: "Valid update for campaign planning." },
        ],
      },
      basePayload,
      "deepseek",
    );
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].action).toBe("update_planning_object");
  });

  it("removes updates missing a note", () => {
    const result = normalizeOrchestratorResponse(
      {
        answer: "Missing note.",
        updates: [
          { action: "update_content_requirements" },
          { action: "update_rollout_lane", note: "" },
          { action: "update_content_object", note: "Valid note." },
        ],
      },
      basePayload,
      "deepseek",
    );
    expect(result.updates).toHaveLength(1);
    expect(result.updates[0].action).toBe("update_content_object");
  });

  it("limits to 8 updates", () => {
    const manyUpdates = Array.from({ length: 12 }, (_, i) => ({
      action: "update_content_requirements",
      note: `Update ${i + 1}`,
    }));
    const result = normalizeOrchestratorResponse(
      { answer: "Limited.", updates: manyUpdates },
      basePayload,
      "deepseek",
    );
    expect(result.updates).toHaveLength(8);
  });

  it("omits the updates key when the array is empty", () => {
    const result = normalizeOrchestratorResponse(
      { answer: "No updates.", updates: [] },
      basePayload,
      "deepseek",
    );
    expect(result).not.toHaveProperty("updates");
  });

  it("omits the updates key when all updates are invalid", () => {
    const result = normalizeOrchestratorResponse(
      {
        answer: "All invalid.",
        updates: [
          { action: "bad_action", note: "nope" },
          { note: "missing action" },
          null,
        ],
      },
      basePayload,
      "deepseek",
    );
    expect(result).not.toHaveProperty("updates");
  });

  it("preserves status when it is a valid work object status", () => {
    const result = normalizeOrchestratorResponse(
      {
        answer: "Status included.",
        updates: [
          { action: "update_planning_object", note: "Draft objective.", status: "revision-requested" },
        ],
      },
      basePayload,
      "deepseek",
    );
    expect(result.updates[0].status).toBe("revision-requested");
  });

  it("strips invalid status values", () => {
    const result = normalizeOrchestratorResponse(
      {
        answer: "Bad status.",
        updates: [
          { action: "update_planning_object", note: "Bad status.", status: "published" },
        ],
      },
      basePayload,
      "deepseek",
    );
    expect(result.updates[0].status).toBeUndefined();
  });
});

describe("runtime event helpers", () => {
  it("creates a normalized audit fallback event", () => {
    const event = createRuntimeEvent({
      type: "unknown",
      campaignId: " camp_04 ",
      workspace: "",
      actor: "",
      payload: "bad",
      timestamp: "2026-07-06T00:00:00.000Z",
    });

    expect(event.type).toBe("audit");
    expect(event.campaignId).toBe("camp_04");
    expect(event.workspace).toBe("global");
    expect(event.actor).toBe("panda-runtime");
    expect(event.payload).toEqual({});
    expect(event.timestamp).toBe("2026-07-06T00:00:00.000Z");
  });

  it("creates agent message events without leaking oversized text", () => {
    const event = createAgentMessageEvent({
      campaignId: "camp_04",
      workspace: "campaign-planning",
      role: "user",
      text: ` ${"x".repeat(2100)} `,
    });

    expect(event.type).toBe("agent_message");
    expect(event.payload.role).toBe("user");
    expect(event.payload.text).toHaveLength(2000);
  });

  it("creates object patch events for specialist workspace changes", () => {
    const event = createObjectPatchEvent({
      campaignId: "camp_04",
      workspace: "campaign-planning",
      objectId: "channel-strategy",
      action: "update_planning_object",
      note: "Channel strategy completed in H1.",
      patch: { status: "in-review" },
    });

    expect(event.type).toBe("object_patch");
    expect(event.payload.objectId).toBe("channel-strategy");
    expect(event.payload.patch).toEqual({ status: "in-review" });
  });

  it("creates gate decision events with safe defaults", () => {
    const event = createGateDecisionEvent({
      campaignId: "camp_04",
      gateId: "H1",
      decision: "publish",
      reviewer: "Vincent",
      comment: "Needs revision before approval.",
    });

    expect(event.type).toBe("gate_decision");
    expect(event.workspace).toBe("gates");
    expect(event.actor).toBe("Vincent");
    expect(event.payload.decision).toBe("revision-requested");
  });
});

function createRequest(method, body) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  req.method = method;
  req.url = "/";
  req.headers = { "content-type": "application/json" };
  return req;
}

function createResponse() {
  return {
    headers: {},
    status: 0,
    body: "",
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(status, headers = {}) {
      this.status = status;
      for (const [name, value] of Object.entries(headers)) this.setHeader(name, value);
    },
    end(value = "") {
      this.body += value;
    },
  };
}

function restoreEnvKey(name, value) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function createFakeSupabaseClient(scripts = {}) {
  const operations = [];
  const tables = new Map();
  const rpcs = new Map();

  for (const [key, value] of Object.entries(scripts)) {
    if (key === "rpc") {
      for (const [fn, queue] of Object.entries(value || {})) {
        rpcs.set(fn, Array.isArray(queue) ? [...queue] : [queue]);
      }
      continue;
    }

    tables.set(key, value);
  }

  const client = {
    from(table) {
      return createFakeQueryBuilder({ table, operations, scripts: tables });
    },
    rpc(fn, args) {
      operations.push({
        kind: "rpc",
        fn,
        args: cloneValue(args),
      });

      const queue = rpcs.get(fn) || [];
      const next = queue.length ? queue.shift() : { data: null, error: null };
      rpcs.set(fn, queue);
      return Promise.resolve(next);
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
