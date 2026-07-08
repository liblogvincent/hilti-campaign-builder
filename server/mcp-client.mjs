const DEFAULT_FIGMA_MCP_URL = "https://mcp.figma.com/mcp";
const DEFAULT_FIGMA_MCP_TOOL = "generate_figma_design";

export function resolveMcpClientConfig({ env = process.env, connection, tool } = {}) {
  const url = firstNonEmpty(env.FIGMA_MCP_URL, env.MCP_FIGMA_URL) || DEFAULT_FIGMA_MCP_URL;
  const resolvedTool = firstNonEmpty(tool, env.FIGMA_MCP_TOOL) || DEFAULT_FIGMA_MCP_TOOL;
  const accessToken = firstNonEmpty(connection?.accessToken, env.FIGMA_MCP_ACCESS_TOKEN);
  return {
    url,
    tool: resolvedTool,
    accessToken,
    configured: Boolean(url),
    authenticated: Boolean(accessToken),
    remote: /^https:\/\/mcp\.figma\.com\/mcp\/?$/i.test(url),
  };
}

export async function callMcpTool({
  env = process.env,
  connection,
  tool,
  argumentsPayload = {},
  fetchImpl = fetch,
} = {}) {
  const config = resolveMcpClientConfig({ env, connection, tool });
  if (!config.configured) {
    return {
      ok: false,
      status: "not-configured",
      authRequired: false,
      tool: config.tool,
      error: "MCP URL is not configured.",
    };
  }
  if (config.remote && !config.authenticated) {
    return {
      ok: false,
      status: "auth-required",
      authRequired: true,
      tool: config.tool,
      url: config.url,
      error: "Figma remote MCP requires OAuth authentication before Panda can call canvas-writing tools.",
    };
  }

  const response = await fetchImpl(config.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      ...(config.accessToken ? { Authorization: `Bearer ${config.accessToken}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `panda-mcp-${Date.now()}`,
      method: "tools/call",
      params: {
        name: config.tool,
        arguments: argumentsPayload,
      },
    }),
  });

  const text = await response.text();
  if (response.status === 401 || response.status === 403) {
    return {
      ok: false,
      status: "unauthorized",
      authRequired: true,
      tool: config.tool,
      url: config.url,
      error: "Figma MCP authentication failed. Reconnect Figma MCP and retry.",
      response: text.slice(0, 2000),
    };
  }
  if (!response.ok) {
    return {
      ok: false,
      status: "failed",
      authRequired: false,
      tool: config.tool,
      url: config.url,
      error: `MCP server returned HTTP ${response.status}.`,
      response: text.slice(0, 2000),
    };
  }
  return {
    ok: true,
    status: "ok",
    authRequired: false,
    tool: config.tool,
    url: config.url,
    response: parseMcpResponse(text),
  };
}

export function parseMcpResponse(text) {
  const rawText = String(text || "");
  const eventData = rawText
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .find((line) => line && line !== "[DONE]");
  const raw = eventData || rawText;
  if (!raw.trim()) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw.slice(0, 2000);
  }
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}
