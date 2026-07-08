import { createHash, randomBytes } from "node:crypto";

const FIGMA_PROTECTED_RESOURCE_METADATA = "https://mcp.figma.com/.well-known/oauth-protected-resource";
const FIGMA_AUTH_SERVER_METADATA = "https://api.figma.com/.well-known/oauth-authorization-server";

export async function discoverFigmaMcpOAuth({ fetchImpl = fetch } = {}) {
  const protectedResource = await fetchJson(fetchImpl, FIGMA_PROTECTED_RESOURCE_METADATA);
  const authServerUrl = Array.isArray(protectedResource.authorization_servers) && protectedResource.authorization_servers[0]
    ? `${String(protectedResource.authorization_servers[0]).replace(/\/$/, "")}/.well-known/oauth-authorization-server`
    : FIGMA_AUTH_SERVER_METADATA;
  const authServer = await fetchJson(fetchImpl, authServerUrl);
  return {
    resource: stringValue(protectedResource.resource) || "https://mcp.figma.com/mcp",
    scope: Array.isArray(protectedResource.scopes_supported) && protectedResource.scopes_supported[0]
      ? String(protectedResource.scopes_supported[0])
      : "mcp:connect",
    authorizationEndpoint: stringValue(authServer.authorization_endpoint),
    tokenEndpoint: stringValue(authServer.token_endpoint),
    registrationEndpoint: stringValue(authServer.registration_endpoint),
    issuer: stringValue(authServer.issuer),
  };
}

export async function registerFigmaMcpClient({
  registrationEndpoint,
  redirectUri,
  fetchImpl = fetch,
  clientName = "Panda Campaign Builder",
} = {}) {
  if (!registrationEndpoint) throw new Error("Figma OAuth registration endpoint is missing.");
  if (!redirectUri) throw new Error("Figma OAuth redirect URI is missing.");
  const response = await fetchImpl(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      scope: "mcp:connect",
      token_endpoint_auth_method: "client_secret_post",
    }),
  });
  if (!response.ok) {
    throw new Error(`Figma OAuth client registration failed with HTTP ${response.status}: ${await safeText(response)}`);
  }
  const body = await response.json();
  const clientId = stringValue(body.client_id);
  if (!clientId) throw new Error("Figma OAuth registration did not return client_id.");
  return {
    clientId,
    clientSecret: stringValue(body.client_secret),
  };
}

export function createPkcePair() {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge, method: "S256" };
}

export function createOAuthState() {
  return base64Url(randomBytes(24));
}

export function buildFigmaAuthorizationUrl({
  authorizationEndpoint,
  clientId,
  redirectUri,
  state,
  codeChallenge,
  resource = "https://mcp.figma.com/mcp",
  scope = "mcp:connect",
} = {}) {
  const url = new URL(authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", state);
  url.searchParams.set("resource", resource);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeFigmaOAuthCode({
  tokenEndpoint,
  clientId,
  clientSecret,
  code,
  codeVerifier,
  redirectUri,
  fetchImpl = fetch,
} = {}) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });
  if (clientSecret) body.set("client_secret", clientSecret);
  const response = await fetchImpl(tokenEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: body.toString(),
  });
  if (!response.ok) {
    throw new Error(`Figma OAuth token exchange failed with HTTP ${response.status}: ${await safeText(response)}`);
  }
  const data = await response.json();
  const accessToken = stringValue(data.access_token);
  if (!accessToken) throw new Error("Figma OAuth token response did not include access_token.");
  const expiresIn = Number(data.expires_in || 3600);
  return {
    accessToken,
    refreshToken: stringValue(data.refresh_token),
    tokenType: stringValue(data.token_type) || "Bearer",
    expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    scope: stringValue(data.scope),
  };
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`Figma OAuth metadata request failed with HTTP ${response.status}: ${await safeText(response)}`);
  return response.json();
}

async function safeText(response) {
  try {
    return (await response.text()).slice(0, 1000);
  } catch {
    return "";
  }
}

function stringValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function base64Url(buffer) {
  return Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
