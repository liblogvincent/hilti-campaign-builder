const FIGMA_API_BASE_URL = "https://api.figma.com/v1";
const DEFAULT_MCP_URL = "http://127.0.0.1:3845/mcp";
const DEFAULT_MCP_TOOL = "create_figma_mapping_board";

export function resolveFigmaConfig(env = process.env) {
  const token = firstNonEmpty(env.FIGMA_TOKEN, env.FIGMA_API_TOKEN, env.FIGMA_PERSONAL_ACCESS_TOKEN);
  const mcpUrl = firstNonEmpty(env.FIGMA_MCP_URL, env.FIGMA_DESKTOP_MCP_URL);
  const mcpTool = firstNonEmpty(env.FIGMA_MCP_TOOL) || DEFAULT_MCP_TOOL;
  return {
    token,
    mcpUrl,
    mcpTool,
    restConfigured: Boolean(token),
    mcpConfigured: Boolean(mcpUrl),
    mcpDefaultUrl: DEFAULT_MCP_URL,
  };
}

export function parseFigmaFileKey(input) {
  const value = String(input || "").trim();
  if (!value) return "";
  const urlMatch = value.match(/figma\.com\/(?:file|design|slides|board)\/([A-Za-z0-9_-]+)/i);
  if (urlMatch?.[1]) return urlMatch[1];
  const keyMatch = value.match(/^[A-Za-z0-9_-]{8,}$/);
  return keyMatch ? value : "";
}

export function buildFigmaMappingManifest(payload = {}) {
  const plan = payload.campaign_plan && typeof payload.campaign_plan === "object" ? payload.campaign_plan : {};
  const requirements = Array.isArray(payload.content_requirements) ? payload.content_requirements : [];
  const channels = uniqueStrings(requirements.map((item) => item?.channel));
  const frames = channels.map((channel) => {
    const channelRequirements = requirements.filter((item) => item?.channel === channel);
    return {
      name: `${channel} content frame`,
      channel,
      placeholderCount: channelRequirements.length,
      placeholders: channelRequirements.map((item) => ({
        id: String(item.id || `${slug(channel)}-${slug(item.assetType || "asset")}`),
        title: String(item.title || item.assetType || "Content placeholder"),
        assetType: String(item.assetType || "Content asset"),
        locale: String(item.locale || "master"),
        owner: String(item.owner || "Content / Creative"),
        rolloutTarget: String(item.rolloutTarget || "Content"),
      })),
    };
  });

  return {
    schema: "panda.figma.mapping.v1",
    campaignId: String(payload.campaign_id || plan.campaignId || "camp_04"),
    campaignName: String(plan.name || "Panda campaign"),
    source: "Panda Content Planning",
    frameCount: frames.length,
    placeholderCount: requirements.length,
    frames,
    notes: [
      "Panda generated this mapping from the content requirement matrix.",
      "Use Figma MCP write-to-canvas to create or update native frames from this manifest.",
    ],
  };
}

export function createFigmaCommentMessage(manifest) {
  const lines = [
    `Panda content planning mapping: ${manifest.campaignName}`,
    `${manifest.frameCount} frame groups, ${manifest.placeholderCount} placeholders.`,
    ...manifest.frames.slice(0, 8).map((frame) => `- ${frame.name}: ${frame.placeholderCount} placeholders`),
  ];
  if (manifest.frames.length > 8) lines.push(`- ${manifest.frames.length - 8} more frame groups in Panda.`);
  return lines.join("\n").slice(0, 3900);
}

export async function syncFigmaBoard(payload = {}, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const config = resolveFigmaConfig(env);
  const mode = payload.mode === "update" ? "update" : "create";
  const fileKey = parseFigmaFileKey(payload.figma_file || payload.figma_url || payload.existing_board);
  const manifest = buildFigmaMappingManifest(payload);

  if (!config.restConfigured) {
    return {
      ok: false,
      mode,
      capability: config.mcpConfigured ? "mcp-configured" : "needs-figma-token",
      warning: "Figma token is not configured. Add FIGMA_TOKEN to enable real file verification and comments.",
      manifest,
    };
  }

  if (!fileKey) {
    const mcp = config.mcpConfigured
      ? await callFigmaMcpBridge({
        config,
        fetchImpl,
        manifest,
        fileKey: "",
        mode,
      })
      : null;
    return {
      ok: Boolean(mcp?.ok),
      mode,
      capability: config.mcpConfigured ? "mcp-board-sync" : "rest-configured",
      warning: mcp?.ok
        ? undefined
        : mode === "create"
          ? "Figma REST is configured, but native board creation requires Figma MCP. Paste an existing Figma file URL to sync a real comment, or configure FIGMA_MCP_URL for canvas writes."
          : "Paste a valid Figma file URL or file key before syncing.",
      manifest,
      mcp,
    };
  }

  const file = await fetchFigmaFile(fileKey, config.token, fetchImpl);
  const comment = await postFigmaComment(fileKey, createFigmaCommentMessage(manifest), config.token, fetchImpl);
  const mcp = config.mcpConfigured && payload.sync_canvas === true
    ? await callFigmaMcpBridge({ config, fetchImpl, manifest, fileKey, mode })
    : null;
  return {
    ok: true,
    mode,
    capability: mcp?.ok ? "rest-and-mcp-sync" : config.mcpConfigured ? "rest-and-mcp-ready" : "rest-comment-sync",
    fileKey,
    fileName: file.name,
    fileUrl: `https://www.figma.com/file/${fileKey}`,
    commentId: comment.id,
    syncedAt: new Date().toISOString(),
    manifest,
    mcp,
    nextAction: mcp?.ok
      ? "Figma file comment and MCP canvas sync completed."
      : config.mcpConfigured
        ? "Figma comment was synced. Enable canvas sync to call the configured MCP bridge."
        : "Figma comment was synced. Configure FIGMA_MCP_URL for native frame creation.",
  };
}

async function fetchFigmaFile(fileKey, token, fetchImpl) {
  const response = await figmaFetch(fetchImpl, `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}`, token);
  const body = await response.json();
  return {
    name: typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Untitled Figma file",
  };
}

async function postFigmaComment(fileKey, message, token, fetchImpl) {
  const response = await figmaFetch(fetchImpl, `${FIGMA_API_BASE_URL}/files/${encodeURIComponent(fileKey)}/comments`, token, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  return response.json();
}

async function figmaFetch(fetchImpl, url, token, init = {}) {
  const response = await fetchImpl(url, {
    ...init,
    headers: {
      ...(init.headers || {}),
      "X-Figma-Token": token,
    },
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.message || body?.err || "";
    } catch {
      detail = "";
    }
    throw new Error(`Figma API request failed with ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  return response;
}

async function callFigmaMcpBridge({ config, fetchImpl, manifest, fileKey, mode }) {
  try {
    const response = await fetchImpl(config.mcpUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `panda-figma-${Date.now()}`,
        method: "tools/call",
        params: {
          name: config.mcpTool,
          arguments: {
            mode,
            fileKey,
            manifest,
          },
        },
      }),
    });
    if (!response.ok) {
      return {
        ok: false,
        error: `Figma MCP bridge returned HTTP ${response.status}`,
      };
    }
    return {
      ok: true,
      tool: config.mcpTool,
      response: await readMcpResponse(response),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Figma MCP bridge call failed",
    };
  }
}

async function readMcpResponse(response) {
  const text = await response.text();
  if (!text.trim()) return null;
  const eventData = text
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trim())
    .find((line) => line && line !== "[DONE]");
  const raw = eventData || text;
  try {
    return JSON.parse(raw);
  } catch {
    return raw.slice(0, 2000);
  }
}

function uniqueStrings(values) {
  return Array.from(new Set(values.map((value) => String(value || "").trim()).filter(Boolean)));
}

function firstNonEmpty(...values) {
  return values.find((value) => typeof value === "string" && value.trim())?.trim() || "";
}

function slug(value) {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    || "item";
}
