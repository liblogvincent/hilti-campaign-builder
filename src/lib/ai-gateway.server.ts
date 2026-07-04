import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const LOVABLE_AIG_RUN_ID_HEADER = "X-Lovable-AIG-Run-ID";

export interface GatewayConfig {
  apiKey: string;
  baseURL: string;
}

/**
 * Resolve AI gateway config from environment variables.
 * Uses 580.ai proxy (LLM_580_API_KEY + LLM_580_BASE_URL)
 */
export function resolveGatewayConfig(): GatewayConfig {
  const key580 = process.env.LLM_580_API_KEY;
  const url580 = process.env.LLM_580_BASE_URL;
  if (key580 && url580) {
    return { apiKey: key580, baseURL: url580 };
  }
  throw new Error("No AI gateway configured. Set LLM_580_API_KEY and LLM_580_BASE_URL environment variables.");
}

export function createAiGatewayProvider(
  config: GatewayConfig,
  initialRunId?: string,
) {
  let runId = initialRunId?.trim() || undefined;
  let resolveRunId: (value: string | undefined) => void = () => {};
  let runIdResolved = false;
  const runIdReady = new Promise<string | undefined>((resolve) => {
    resolveRunId = resolve;
  });
  const publishRunId = (value?: string) => {
    const next = value?.trim() || undefined;
    if (!runId && next) runId = next;
    if (!runIdResolved) {
      runIdResolved = true;
      resolveRunId(runId);
    }
  };
  if (runId) publishRunId(runId);

  const provider = createOpenAICompatible({
    name: "ai-gateway",
    baseURL: config.baseURL,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
    },
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      if (runId && !headers.has(LOVABLE_AIG_RUN_ID_HEADER)) {
        headers.set(LOVABLE_AIG_RUN_ID_HEADER, runId);
      }
      try {
        const response = await fetch(input, { ...init, headers });
        publishRunId(response.headers.get(LOVABLE_AIG_RUN_ID_HEADER) ?? undefined);
        return response;
      } catch (err) {
        publishRunId(undefined);
        throw err;
      }
    },
  });

  return Object.assign(provider, {
    getRunId: () => runId,
    waitForRunId: () => (runId ? Promise.resolve(runId) : runIdReady),
  });
}

/** @deprecated — use createAiGatewayProvider + resolveGatewayConfig instead */
export function createLovableAiGatewayProvider(
  lovableApiKey: string,
  initialRunId?: string,
) {
  return createAiGatewayProvider(
    { apiKey: lovableApiKey, baseURL: "https://ai.gateway.lovable.dev/v1" },
    initialRunId,
  );
}
