import { describe, expect, it, vi } from "vitest";
import { callMcpTool, resolveMcpClientConfig } from "./mcp-client.mjs";

describe("MCP client", () => {
  it("resolves remote Figma MCP config from env and connection token", () => {
    const config = resolveMcpClientConfig({
      env: { FIGMA_MCP_URL: "https://mcp.figma.com/mcp", FIGMA_MCP_TOOL: "generate_figma_design" },
      connection: { accessToken: "oauth-token" },
    });

    expect(config).toMatchObject({
      url: "https://mcp.figma.com/mcp",
      tool: "generate_figma_design",
      accessToken: "oauth-token",
      configured: true,
      authenticated: true,
    });
  });

  it("returns an auth-required result before calling remote MCP without a token", async () => {
    const fetchImpl = vi.fn();
    const result = await callMcpTool({
      env: { FIGMA_MCP_URL: "https://mcp.figma.com/mcp" },
      tool: "generate_figma_design",
      argumentsPayload: { fileKey: "abc" },
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: false,
      authRequired: true,
      status: "auth-required",
    });
    expect(result.error).toContain("OAuth");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("normalizes a remote MCP 401 response as auth required", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    }));

    const result = await callMcpTool({
      env: { FIGMA_MCP_URL: "https://mcp.figma.com/mcp" },
      connection: { accessToken: "expired" },
      tool: "generate_figma_design",
      argumentsPayload: { fileKey: "abc" },
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: false,
      authRequired: true,
      status: "unauthorized",
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://mcp.figma.com/mcp",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer expired" }),
      }),
    );
  });

  it("returns parsed MCP tool output on success", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => 'data: {"result":{"content":[{"type":"text","text":"created"}]}}\n\n',
    }));

    const result = await callMcpTool({
      env: { FIGMA_MCP_URL: "https://mcp.figma.com/mcp" },
      connection: { accessToken: "valid" },
      tool: "generate_figma_design",
      argumentsPayload: { fileKey: "abc" },
      fetchImpl,
    });

    expect(result).toMatchObject({
      ok: true,
      status: "ok",
      tool: "generate_figma_design",
      response: { result: { content: [{ type: "text", text: "created" }] } },
    });
  });
});
