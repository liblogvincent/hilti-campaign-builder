import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { handleAgent, handleGateDecision, handleHealth, handleHomeDraft, handleHomeTurn, handleIntegrationPackage, handleOrchestrator, handleResearchUrl, normalizeHomeDraftResponse, normalizeHomeTurnResponse, normalizeOrchestratorResponse, researchUrl } from "./panda-api.mjs";
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

  it("researches a campaign URL and returns usable page evidence", async () => {
    const html = `
      <html>
        <head>
          <title>Cold Cut Promo | Hilti Hong Kong</title>
          <meta name="description" content="Metal Cutting Made Safer, Faster and Cleaner">
          <script>window.secret = "ignore";</script>
        </head>
        <body>
          <h1>Metal Cutting Made Safer, Faster and Cleaner</h1>
          <p>Save 20% on cordless cold-cutting solutions with promo code CUT20.</p>
          <p>Cold-cutting solutions help reduce sparks, smoke and finishing time.</p>
        </body>
      </html>`;
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => html,
    }));

    const evidence = await researchUrl("https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo", fetchImpl);

    expect(fetchImpl).toHaveBeenCalledWith("https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo", expect.any(Object));
    expect(evidence.ok).toBe(true);
    expect(evidence.title).toBe("Cold Cut Promo | Hilti Hong Kong");
    expect(evidence.summary).toContain("Metal Cutting Made Safer, Faster and Cleaner");
    expect(evidence.summary).toContain("CUT20");
    expect(evidence.summary).not.toContain("window.secret");
  });

  it("serves URL research through the API handler", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => "text/html" },
      text: async () => "<title>Cold Cut</title><h1>Metal Cutting Made Safer</h1><p>20% off with CUT20.</p>",
    }));
    const res = createResponse();

    await handleResearchUrl(createRequest("POST", { url: "https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo" }), res);

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary).toContain("CUT20");
    globalThis.fetch = originalFetch;
  });

  it("normalizes a model-drafted Home brief with structured campaign fields", () => {
    const result = normalizeHomeDraftResponse(
      {
        answer: "I researched the cold cut page and drafted a campaign brief for review before creating the workspace.",
        draft: {
          campaignName: "Cold Cut Global Campaign",
          heroProduct: "Cold cut",
          objective: "Drive safer metal cutting demand from trade buyers.",
          audience: ["Contractors", "Installers", "Trade buyers"],
          markets: ["Global markets"],
          locales: ["Market-localized variants TBD"],
          channels: ["Paid Media", "Email", "HOL Landing Page"],
          kpiCandidates: ["Qualified HOL visits", "Promotion-code engagement"],
          budgetAssumptions: "To be defined after Campaign Planning and Content Planning review",
          timingAssumptions: "Market leaders will confirm launch waves after review.",
          missingInputs: ["Market priority", "Budget owner", "Claim evidence"],
          sourceEvidence: ["Hilti page says cleaner cuts and fewer sparks.", "Promo code CUT20 appears on the page."],
        },
        suggested_actions: ["Review brief", "Switch to Create when ready"],
      },
      {
        prompt:
          "I want a campaign for cold cut, the products you can check here https://www.hilti.com.hk/content/shop/promotions/local/cold-cut-promo and budget should be defined after campaign and content planning.",
        research_evidence: [],
      },
      "deepseek",
    );

    expect(result.mode).toBe("deepseek");
    expect(result.answer).toContain("review");
    expect(result.answer).toContain("Hilti page says cleaner cuts");
    expect(result.draft.heroProduct).toBe("Cold cut");
    expect(result.draft.markets).toEqual(["Global markets"]);
    expect(result.draft.channels).toContain("HOL Landing Page");
    expect(result.draft.channels).toContain("Organic/HN");
    expect(result.draft.budgetAssumptions).toBe("To be defined after Campaign Planning and Content Planning review");
    expect(result.suggested_actions).toContain("Switch to Create when ready");
  });

  it("serves Home draft through DeepSeek with URL evidence and no template-only response", async () => {
    const callJsonAgentSpy = vi.spyOn(aiTransport, "callJsonAgent").mockResolvedValueOnce({
      mode: "deepseek",
      answer: "I reviewed the Hilti cold cut page, captured the safer cleaner cutting proof points, and drafted a reviewable campaign brief.",
      draft: {
        campaignName: "Cold Cut Global Campaign",
        heroProduct: "cold cut",
        objective: "Create qualified demand for safer, cleaner metal cutting.",
        audience: ["Contractors", "Installers", "Trade buyers"],
        markets: ["Global markets"],
        locales: ["Market-localized variants TBD"],
        channels: ["Paid Media", "Email", "HOL Landing Page", "Organic/HN"],
        kpiCandidates: ["Qualified HOL visits", "Promotion-code engagement"],
        budgetAssumptions: "To be defined after Campaign Planning and Content Planning review",
        timingAssumptions: "Launch waves to be agreed with market leaders.",
        missingInputs: ["Market priority", "Budget owner"],
        sourceEvidence: ["CUT20 appeared on the researched page."],
      },
      suggested_actions: ["Review brief", "Switch to Create when ready"],
    });
    const res = createResponse();

    await handleHomeDraft(
      createRequest("POST", {
        prompt: "I want a campaign for cold cut",
        research_evidence: [{ ok: true, title: "Cold Cut Promo | Hilti Hong Kong", summary: "CUT20 and cleaner cutting proof points." }],
      }),
      res,
    );

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.mode).toBe("deepseek");
    expect(body.answer).toContain("Hilti cold cut page");
    expect(body.draft.heroProduct).toBe("cold cut");
    expect(body.draft.sourceEvidence).toContain("CUT20 appeared on the researched page.");
    expect(callJsonAgentSpy).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({
        prompt: "I want a campaign for cold cut",
        research_evidence: expect.any(Array),
      }),
      systemPrompt: expect.stringContaining("draft the brief and initial plan"),
    }));
    callJsonAgentSpy.mockRestore();
  });

  it("answers Home follow-up questions from the active draft instead of workflow blockers", () => {
    const result = normalizeHomeTurnResponse(
      { answer: "The assumptions are in budgetAssumptions, timingAssumptions, and missingInputs." },
      {
        question: "where is the assumption?",
        active_draft: {
          campaignName: "Diamond Coring Demand Campaign",
          heroProduct: "Hilti diamond coring products",
          objective: "Create qualified demand for dust-controlled, precise coring solutions.",
          audience: ["Contractors", "Installers", "Specifiers"],
          markets: ["Global markets"],
          locales: ["Market-localized variants TBD"],
          channels: ["Paid Media", "Email", "HOL Landing Page", "Organic/HN"],
          kpiCandidates: ["Qualified HOL visits", "Lead form completions"],
          budgetAssumptions: "Budget to be defined after Campaign Planning and Content Planning review.",
          timingAssumptions: "Launch window to be agreed with market leaders after plan review.",
          missingInputs: ["Priority markets", "Budget owner", "Hero offer", "Claim evidence"],
          sourceEvidence: ["User asked for Hilti diamond coring products."],
        },
      },
      "fixture",
    );

    expect(result.answer).toContain("To be defined");
    expect(result.answer).toContain("Launch window");
    expect(result.answer).toContain("Priority markets");
    expect(result.answer).not.toMatch(/\bblocked\b/i);
    expect(result.answer).not.toContain("Risk lane");
    expect(result.answer).not.toContain("budgetAssumptions");
    expect(result.answer).not.toContain("missingInputs");
    expect(result.answer).not.toMatch(/\bapproval\b/i);
    expect(result.answer).not.toMatch(/\bH[1-4]\b/);
    expect(result.draft.heroProduct).toBe("Hilti diamond coring products");
    expect(result.intent).toBe("answer-draft-question");
  });

  it("serves Home turns through the action runtime contract", async () => {
    const callJsonAgentSpy = vi.spyOn(aiTransport, "callJsonAgent").mockResolvedValueOnce({
      mode: "deepseek",
      answer: "Here are the current assumptions in the draft: global scope, market leaders refine priority markets, and budget follows the plan review.",
      draft: {
        campaignName: "Diamond Coring Demand Campaign",
        heroProduct: "Hilti diamond coring products",
        objective: "Create qualified demand for precise coring solutions.",
        audience: ["Contractors", "Installers"],
        markets: ["Global markets"],
        locales: ["Market-localized variants TBD"],
        channels: ["Paid Media", "Email", "HOL Landing Page", "Organic/HN"],
        kpiCandidates: ["Qualified HOL visits"],
        budgetAssumptions: "Budget follows plan review.",
        timingAssumptions: "Market leaders confirm timing.",
        missingInputs: ["Priority markets"],
        sourceEvidence: ["User supplied product family."],
      },
      draftPatch: { missingInputs: ["Priority markets", "Hero offer"] },
      suggested_actions: ["Revise draft", "Create campaign workspace"],
      intent: "answer-draft-question",
    });
    const res = createResponse();

    await handleHomeTurn(
      createRequest("POST", {
        question: "where are the assumptions?",
        active_draft: {
          campaignName: "Diamond Coring Demand Campaign",
          heroProduct: "Hilti diamond coring products",
          objective: "Create qualified demand for precise coring solutions.",
          audience: ["Contractors"],
          markets: ["Global markets"],
          locales: ["Market-localized variants TBD"],
          channels: ["Paid Media"],
          kpiCandidates: ["Qualified HOL visits"],
          budgetAssumptions: "Budget follows plan review.",
          timingAssumptions: "Market leaders confirm timing.",
          missingInputs: ["Priority markets"],
          sourceEvidence: ["User supplied product family."],
        },
      }),
      res,
    );

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.mode).toBe("deepseek");
    expect(body.answer).toContain("current assumptions");
    expect(body.draftPatch.missingInputs).toContain("Hero offer");
    expect(body.suggested_actions).toContain("Create campaign workspace");
    expect(callJsonAgentSpy).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ question: "where are the assumptions?" }),
      systemPrompt: expect.stringContaining("campaign-building agent"),
    }));
    callJsonAgentSpy.mockRestore();
  });

  it("starts a new Home draft when the user gives a new campaign brief even if an older draft exists", () => {
    const result = normalizeHomeTurnResponse(
      {},
      {
        question: "I want a campaign for cold cut, it should be launched in global markets and budget should be defined after campaign and content planning.",
        active_draft: {
          campaignName: "Diamond Coring Demand Campaign",
          heroProduct: "Hilti diamond coring products",
          objective: "Create qualified demand for precise coring solutions.",
          audience: ["Contractors", "Installers"],
          markets: ["DACH"],
          locales: ["de-DE"],
          channels: ["Paid Media"],
          kpiCandidates: ["Qualified HOL visits"],
          budgetAssumptions: "Budget follows plan review.",
          timingAssumptions: "Market leaders confirm timing.",
          missingInputs: ["Priority markets"],
          sourceEvidence: ["User supplied product family."],
        },
      },
      "fixture",
    );

    expect(result.intent).toBe("draft-brief");
    expect(result.draft.heroProduct).toBe("cold cut");
    expect(result.draft.markets).toEqual(["Global markets"]);
    expect(result.draft.budgetAssumptions).toBe("To be defined after Campaign Planning and Content Planning review");
    expect(result.answer).toContain("cold cut");
    expect(result.answer).not.toContain("Diamond");
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

  it("persists a human gate decision through the durable runtime handler", async () => {
    const client = createFakeSupabaseClient({
      rpc: {
        persist_gate_decision: [
          {
            data: {
              gate_decision: {
                id: 91,
                campaign_id: "camp_04",
                gate: "H2",
                decision: "approved",
                reviewer: "Vincent",
                comment: "Ready for rollout.",
              },
              campaign: {
                id: "camp_04",
                phase: "rollout",
                active_gate: "H3",
              },
              runtime_event: {
                id: "gate_decision_01",
                campaign_id: "camp_04",
                workspace: "gates",
                type: "gate_decision",
                actor: "Vincent",
                payload: { gateId: "H2", decision: "approved", comment: "Ready for rollout." },
                created_at: "2026-07-06T00:00:05.000Z",
              },
            },
            error: null,
          },
        ],
      },
      campaigns: {
        select: [
          {
            data: {
              id: "camp_04",
              name: "Fixture Campaign",
              brief: "Plan a campaign",
              phase: "rollout",
              active_gate: "H3",
              owner_role: "Campaign Owner",
              updated_at: "2026-07-06T00:00:05.000Z",
            },
            error: null,
          },
        ],
      },
      campaign_plans: {
        select: [{ data: [], error: null }],
      },
      work_objects: {
        select: [{ data: [], error: null }],
      },
      content_requirements: {
        select: [{ data: [], error: null }],
      },
      gate_decisions: {
        select: [
          {
            data: [
              {
                id: 91,
                campaign_id: "camp_04",
                gate: "H2",
                decision: "approved",
                reviewer: "Vincent",
                comment: "Ready for rollout.",
                created_at: "2026-07-06T00:00:05.000Z",
              },
            ],
            error: null,
          },
        ],
      },
      runtime_events: {
        select: [
          {
            data: [
              {
                id: "gate_decision_01",
                campaign_id: "camp_04",
                workspace: "gates",
                type: "gate_decision",
                actor: "Vincent",
                payload: { gateId: "H2", decision: "approved", comment: "Ready for rollout." },
                created_at: "2026-07-06T00:00:05.000Z",
              },
            ],
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

    const res = createResponse();
    await handleGateDecision(
      createRequest("POST", {
        campaign_id: "camp_04",
        gate_id: "H2",
        decision: "approved",
        reviewer: "Vincent",
        comment: "Ready for rollout.",
        artifacts_reviewed: ["artifact-1"],
      }),
      res,
    );

    const body = JSON.parse(res.body);
    expect(res.status).toBe(200);
    expect(body.persisted).toBe(true);
    expect(body.snapshot.campaign.phase).toBe("rollout");
    expect(body.snapshot.gateDecisions[0]).toMatchObject({
      gateId: "H2",
      decision: "approved",
      reviewer: "Vincent",
    });
    expect(client.operations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "rpc",
          fn: "persist_gate_decision",
          args: expect.objectContaining({
            p_campaign_id: "camp_04",
            p_gate: "H2",
            p_decision: "approved",
            p_reviewer: "Vincent",
            p_comment: "Ready for rollout.",
          }),
        }),
      ]),
    );

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
    update(payload) {
      query.op = "update";
      query.payload = payload;
      return builder;
    },
    delete() {
      query.op = "delete";
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
