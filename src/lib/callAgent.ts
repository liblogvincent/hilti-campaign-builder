// Robust LLM call wrapper with manual JSON extraction + schema-fail self-repair.
//
// WHY manual JSON instead of Output.object(): the 580ai proxy (cn.zhihuiai.top)
// does not reliably relay response_format/json_schema to Claude models, so
// Output.object() consistently fails with "No object generated: could not parse
// the response."  This wrapper uses plain generateText, extracts JSON from the
// raw response, validates against the Zod schema, and self-repairs on failure.
//
// Max 2 repair turns before giving up and throwing — same pattern as v2 Fourier's
// llm-call.ts, but with manual extraction instead of Output.object().
import { generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type { ZodType } from "zod";

const MAX_REPAIR_TURNS = 2;

export interface CallAgentOpts<T> {
  model: LanguageModel;
  schema: ZodType<T>;
  system: string;
  prompt: string;
  /** AbortSignal to cancel the underlying generateText call on timeout. */
  abortSignal?: AbortSignal;
  /**
   * Optional domain validation, run AFTER schema parsing succeeds. When it
   * reports errors, they are fed back to the LLM as a self-repair turn — same
   * budget as JSON/Zod failures. Use for cross-field rules the Zod schema
   * can't express (e.g. plan-vs-archetype conformance).
   */
  validate?: (value: T) => { valid: boolean; errors: string[] };
}

export interface CallAgentResult<T> {
  output: T;
  repairTurns: number;
  /** Token usage from the final (successful) generateText call, if the provider reports it. */
  usage?: { inputTokens?: number; outputTokens?: number };
}

/** Extract a JSON object from an LLM text response. Handles markdown fences,
 *  leading/trailing prose, and code blocks. Returns the first top-level {…}. */
function extractJson(text: string): string {
  // Strip ```json … ``` or ``` … ``` fences
  let cleaned = text;
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1];
  }
  // Find the first { — walk brace depth to find its matching }
  const start = cleaned.indexOf("{");
  if (start === -1) return cleaned;
  let depth = 0;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === "{") depth++;
    else if (cleaned[i] === "}") {
      depth--;
      if (depth === 0) return cleaned.slice(start, i + 1);
    }
  }
  return cleaned.slice(start);
}

function formatZodErrors(err: z.ZodError): string {
  return err.issues
    .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}

/**
 * Call generateText, extract JSON from the response, and validate against
 * the Zod schema. On parse/validation failure, re-prompts the LLM with the
 * specific errors so it can self-correct (max MAX_REPAIR_TURNS).
 */
export async function callAgentWithRepair<T>(
  opts: CallAgentOpts<T>,
): Promise<CallAgentResult<T>> {
  let workingSystem = opts.system;
  let repairTurns = 0;

  for (;;) {
    // 1. Call the LLM — plain generateText, no Output.object()
    let rawText: string;
    let usage: { inputTokens?: number; outputTokens?: number } | undefined;
    try {
      const { text, usage: u } = await generateText({
        model: opts.model,
        system: workingSystem,
        prompt: opts.prompt,
        abortSignal: opts.abortSignal,
      });
      rawText = text;
      usage = u;
    } catch (err) {
      // Transport/timeout errors are not self-repairable — re-throw immediately
      throw err;
    }

    // 2. Extract JSON from the response
    const jsonStr = extractJson(rawText);

    // 3. Parse + schema-validate, then run optional domain validation.
    //    Any failure (parse / Zod / domain) routes to the same self-repair path.
    let repairDetail: string | null = null;
    try {
      const parsed = JSON.parse(jsonStr);
      const validated = opts.schema.parse(parsed);
      const domain = opts.validate?.(validated as T);
      if (domain && !domain.valid) {
        repairDetail = `Schema was valid but these domain rules failed:\n${domain.errors
          .map((e) => `- ${e}`)
          .join("\n")}`;
      } else {
        return { output: validated as T, repairTurns, usage };
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        repairDetail = `JSON parse error: ${err.message}. The text I tried to parse was:\n"""\n${jsonStr.slice(0, 500)}\n"""`;
      } else if (err instanceof z.ZodError) {
        repairDetail = `Schema validation errors:\n${formatZodErrors(err as z.ZodError)}`;
      } else {
        repairDetail = err instanceof Error ? err.message : String(err);
      }
    }

    // 4. Self-repair: re-prompt with the specific error, or throw once exhausted.
    if (repairTurns < MAX_REPAIR_TURNS) {
      repairTurns++;
      workingSystem =
        opts.system +
        `\n\nYour previous response was invalid. ${repairDetail}\n\nReturn ONLY valid JSON — no markdown, no code fences, no prose. Start your response with "{".`;
      continue;
    }
    // Exhausted repair turns — throw so caller falls back
    throw new Error(repairDetail ?? "callAgentWithRepair: exhausted repair turns");
  }
}
