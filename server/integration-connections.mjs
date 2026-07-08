export async function loadIntegrationConnection({ provider, supabase, env = process.env } = {}) {
  const normalizedProvider = String(provider || "").trim().toLowerCase();
  if (!normalizedProvider) return unauthenticatedConnection(provider || "unknown");

  const envToken = tokenFromEnv(normalizedProvider, env);
  if (envToken) {
    return {
      provider: normalizedProvider,
      source: "env",
      accessToken: envToken,
      authenticated: true,
      updatedAt: "",
      metadata: {},
    };
  }

  if (!supabase || typeof supabase.from !== "function") {
    return unauthenticatedConnection(normalizedProvider);
  }

  const { data, error } = await supabase
    .from("integration_connections")
    .select("provider,status,access_token,metadata,updated_at")
    .eq("provider", normalizedProvider)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.access_token) {
    return unauthenticatedConnection(normalizedProvider, error?.message);
  }

  return {
    provider: normalizedProvider,
    source: "supabase",
    accessToken: String(data.access_token),
    authenticated: data.status === "connected",
    updatedAt: typeof data.updated_at === "string" ? data.updated_at : "",
    metadata: data.metadata && typeof data.metadata === "object" ? data.metadata : {},
  };
}

export function summarizeIntegrationConnection(connection) {
  return {
    provider: connection?.provider || "unknown",
    source: connection?.source || "none",
    authenticated: Boolean(connection?.authenticated),
    updatedAt: connection?.updatedAt || "",
    ...(connection?.error ? { error: connection.error } : {}),
  };
}

export async function saveIntegrationOAuthState({
  provider,
  state,
  codeVerifier,
  redirectUri,
  clientId,
  clientSecret,
  metadata = {},
  supabase,
} = {}) {
  if (!supabase || typeof supabase.from !== "function") throw new Error("Supabase is required to persist OAuth state.");
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error } = await supabase.from("integration_oauth_states").insert({
    provider,
    state,
    code_verifier: codeVerifier,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret || null,
    metadata,
    expires_at: expiresAt,
  });
  if (error) throw new Error(`Could not persist ${provider} OAuth state: ${error.message}`);
  return { expiresAt };
}

export async function loadIntegrationOAuthState({ provider, state, supabase } = {}) {
  if (!supabase || typeof supabase.from !== "function") throw new Error("Supabase is required to load OAuth state.");
  const { data, error } = await supabase
    .from("integration_oauth_states")
    .select("provider,state,code_verifier,redirect_uri,client_id,client_secret,metadata,expires_at")
    .eq("provider", provider)
    .eq("state", state)
    .maybeSingle();
  if (error) throw new Error(`Could not load ${provider} OAuth state: ${error.message}`);
  if (!data) return undefined;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) return undefined;
  return {
    provider: data.provider,
    state: data.state,
    codeVerifier: data.code_verifier,
    redirectUri: data.redirect_uri,
    clientId: data.client_id,
    clientSecret: data.client_secret || "",
    metadata: data.metadata || {},
    expiresAt: data.expires_at,
  };
}

export async function saveIntegrationConnection({ provider, token, metadata = {}, supabase } = {}) {
  if (!supabase || typeof supabase.from !== "function") throw new Error("Supabase is required to persist integration connection.");
  const { error } = await supabase.from("integration_connections").upsert({
    provider,
    status: "connected",
    access_token: token.accessToken,
    refresh_token: token.refreshToken || null,
    expires_at: token.expiresAt || null,
    metadata,
    updated_at: new Date().toISOString(),
  }, { onConflict: "provider" });
  if (error) throw new Error(`Could not persist ${provider} connection: ${error.message}`);
  return { ok: true };
}

function unauthenticatedConnection(provider, error = "") {
  return {
    provider,
    source: "none",
    accessToken: "",
    authenticated: false,
    updatedAt: "",
    metadata: {},
    ...(error ? { error } : {}),
  };
}

function tokenFromEnv(provider, env) {
  if (provider === "figma") return firstNonEmpty(env.FIGMA_MCP_ACCESS_TOKEN);
  return "";
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}
