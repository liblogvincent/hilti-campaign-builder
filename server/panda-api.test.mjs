import { Readable } from "node:stream";
import { describe, expect, it } from "vitest";
import { handleAgent, handleHealth, handleIntegrationPackage, handleOrchestrator } from "./panda-api.mjs";
import { callJsonAgent, resolveProviderConfig, parseJsonObject } from "./ai-transport.mjs";

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
