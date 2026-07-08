import { describe, expect, it, vi } from "vitest";
import {
  buildFigmaAuthorizationUrl,
  discoverFigmaMcpOAuth,
  exchangeFigmaOAuthCode,
  registerFigmaMcpClient,
} from "./figma-oauth.mjs";

describe("Figma MCP OAuth", () => {
  it("discovers protected-resource and authorization metadata", async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).includes("oauth-protected-resource")) {
        return {
          ok: true,
          json: async () => ({
            resource: "https://mcp.figma.com/mcp",
            authorization_servers: ["https://api.figma.com"],
            scopes_supported: ["mcp:connect"],
          }),
        };
      }
      if (String(url).includes("oauth-authorization-server")) {
        return {
          ok: true,
          json: async () => ({
            issuer: "https://api.figma.com",
            authorization_endpoint: "https://www.figma.com/oauth/mcp",
            token_endpoint: "https://api.figma.com/v1/oauth/token",
            registration_endpoint: "https://api.figma.com/v1/oauth/mcp/register",
            code_challenge_methods_supported: ["S256"],
          }),
        };
      }
      throw new Error(`Unexpected URL ${url}`);
    });

    const metadata = await discoverFigmaMcpOAuth({ fetchImpl });

    expect(metadata).toMatchObject({
      resource: "https://mcp.figma.com/mcp",
      scope: "mcp:connect",
      authorizationEndpoint: "https://www.figma.com/oauth/mcp",
      tokenEndpoint: "https://api.figma.com/v1/oauth/token",
      registrationEndpoint: "https://api.figma.com/v1/oauth/mcp/register",
    });
  });

  it("registers a Figma MCP OAuth client with redirect uri", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        client_id: "client_123",
        client_secret: "secret_123",
      }),
    }));

    const client = await registerFigmaMcpClient({
      registrationEndpoint: "https://api.figma.com/v1/oauth/mcp/register",
      redirectUri: "https://panda.example.com/api/integrations/figma/oauth/callback",
      fetchImpl,
    });

    expect(client).toEqual({ clientId: "client_123", clientSecret: "secret_123" });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.figma.com/v1/oauth/mcp/register",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("https://panda.example.com/api/integrations/figma/oauth/callback"),
      }),
    );
  });

  it("builds an authorization URL with PKCE and resource", () => {
    const url = buildFigmaAuthorizationUrl({
      authorizationEndpoint: "https://www.figma.com/oauth/mcp",
      clientId: "client_123",
      redirectUri: "https://panda.example.com/callback",
      state: "state_123",
      codeChallenge: "challenge_123",
      resource: "https://mcp.figma.com/mcp",
      scope: "mcp:connect",
    });

    expect(url).toContain("https://www.figma.com/oauth/mcp?");
    expect(url).toContain("client_id=client_123");
    expect(url).toContain("code_challenge=challenge_123");
    expect(url).toContain("resource=https%3A%2F%2Fmcp.figma.com%2Fmcp");
    expect(url).toContain("scope=mcp%3Aconnect");
  });

  it("exchanges an authorization code for an access token", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        access_token: "access_123",
        refresh_token: "refresh_123",
        expires_in: 3600,
        token_type: "Bearer",
      }),
    }));

    const token = await exchangeFigmaOAuthCode({
      tokenEndpoint: "https://api.figma.com/v1/oauth/token",
      clientId: "client_123",
      clientSecret: "secret_123",
      code: "code_123",
      codeVerifier: "verifier_123",
      redirectUri: "https://panda.example.com/callback",
      fetchImpl,
    });

    expect(token).toMatchObject({
      accessToken: "access_123",
      refreshToken: "refresh_123",
      tokenType: "Bearer",
    });
    expect(token.expiresAt).toMatch(/Z$/);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.figma.com/v1/oauth/token",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/x-www-form-urlencoded" }),
      }),
    );
  });
});
