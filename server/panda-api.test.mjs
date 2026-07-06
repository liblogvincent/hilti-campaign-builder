import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { handleAgent, handleHealth, handleIntegrationPackage, handleOrchestrator, normalizeOrchestratorResponse } from "./panda-api.mjs";
import { callJsonAgent, resolveProviderConfig, parseJsonObject } from "./ai-transport.mjs";
import { getAgentDefinition } from "./agent-registry.mjs";

describe("ai transport", () => {
  it("uses fixture mode when no provider key is available", () => {
    const config = resolveProviderConfig({});
    expect(config.mode).toBe("fixture");
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
