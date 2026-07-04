import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveGatewayConfig } from "../ai-gateway.server";

describe("resolveGatewayConfig", () => {
  const orig = { ...process.env };
  beforeEach(() => { delete process.env.LLM_580_API_KEY; delete process.env.LLM_580_BASE_URL; });
  afterEach(() => { process.env = { ...orig }; });

  it("throws when env is unset", () => {
    expect(() => resolveGatewayConfig()).toThrow(/No AI gateway configured/);
  });
  it("returns config when both env vars are set", () => {
    process.env.LLM_580_API_KEY = "k"; process.env.LLM_580_BASE_URL = "https://cn.zhihuiai.top/v1";
    expect(resolveGatewayConfig()).toEqual({ apiKey: "k", baseURL: "https://cn.zhihuiai.top/v1" });
  });
});
