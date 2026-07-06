export function resolveProviderConfig(env = process.env) {
  if (env.DEEPSEEK_API_KEY) {
    const style = env.DEEPSEEK_API_STYLE || "openai";
    return {
      mode: "deepseek",
      transport: env.PANDA_AI_TRANSPORT === "vercel-ai" ? "vercel-ai" : "fetch",
      style,
      baseUrl: env.DEEPSEEK_BASE_URL
        || (style === "anthropic" ? "https://api.deepseek.com/anthropic" : "https://api.deepseek.com"),
      model: env.DEEPSEEK_MODEL
        || (style === "anthropic" ? "deepseek-v4-flash" : "deepseek-chat"),
      timeoutMs: Number(env.DEEPSEEK_TIMEOUT_MS || 20000),
      apiKey: env.DEEPSEEK_API_KEY,
    };
  }
  return { mode: "fixture", transport: "fixture" };
}

export function parseJsonObject(text, fallback) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text).match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export async function callJsonAgent({ payload, systemPrompt, fallback, normalize, env = process.env, fetchImpl = fetch }) {
  const config = resolveProviderConfig(env);
  if (config.mode === "fixture") return { mode: "fixture", ...fallback };

  const result = config.transport === "vercel-ai"
    ? await callVercelAiSdk({ config, payload, systemPrompt })
    : config.style === "anthropic"
    ? await callAnthropicStyle({ config, payload, systemPrompt, fetchImpl })
    : await callOpenAiStyle({ config, payload, systemPrompt, fetchImpl });

  if (!result.ok) return { mode: "fixture", warning: result.warning, ...fallback };

  const parsed = parseJsonObject(result.text, fallback);
  const normalized = normalize(parsed, payload, config.mode);

  if (parsed === fallback) {
    normalized.warning = "DeepSeek returned malformed JSON; Panda normalized it into a safe gate packet.";
  }

  return normalized;
}

async function callVercelAiSdk({ config, payload, systemPrompt }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const { generateText } = await import("ai");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const deepseek = createOpenAI({
      apiKey: config.apiKey,
      baseURL: `${config.baseUrl.replace(/\/$/, "")}/v1`,
    });
    const result = await generateText({
      model: deepseek.chat(config.model),
      system: systemPrompt,
      prompt: JSON.stringify(payload),
      temperature: 0.2,
      abortSignal: controller.signal,
    });
    return { ok: true, text: result?.text || "{}" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, warning: `DeepSeek Vercel AI SDK transport failed: ${message.slice(0, 160)}` };
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenAiStyle({ config, payload, systemPrompt, fetchImpl }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const response = await fetchImpl(`${config.baseUrl}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify({
      model: config.model,
      response_format: { type: "json_object" },
      temperature: 0.25,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: JSON.stringify(payload) },
      ],
    }),
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, warning: `DeepSeek ${response.status}: ${text.slice(0, 160)}` };
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return { ok: true, text: content };
}

async function callAnthropicStyle({ config, payload, systemPrompt, fetchImpl }) {
  const endpoint = config.baseUrl.endsWith("/v1/messages")
    ? config.baseUrl
    : `${config.baseUrl.replace(/\/$/, "")}/v1/messages`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  const response = await fetchImpl(endpoint, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: config.model,
      max_tokens: 1800,
      temperature: 0.25,
      system: systemPrompt,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });
  clearTimeout(timeout);

  if (!response.ok) {
    const text = await response.text();
    return { ok: false, warning: `DeepSeek ${response.status}: ${text.slice(0, 160)}` };
  }

  const data = await response.json();
  const text = Array.isArray(data.content)
    ? data.content.map((block) => block.text || "").join("")
    : data.content || "{}";
  return { ok: true, text };
}
