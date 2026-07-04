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
}

export interface CallAgentResult<T> {
  output: T;
  repairTurns: number;
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
    try {
      const { text } = await generateText({
        model: opts.model,
        system: workingSystem,
        prompt: opts.prompt,
        abortSignal: opts.abortSignal,
      });
      rawText = text;
    } catch (err) {
      // Transport/timeout errors are not self-repairable — re-throw immediately
      throw err;
    }

    // 2. Extract JSON from the response
    const jsonStr = extractJson(rawText);

    // 3. Parse and validate
    try {
      const parsed = JSON.parse(jsonStr);
      const validated = opts.schema.parse(parsed);
      return { output: validated as T, repairTurns };
    } catch (err) {
      // 4. Self-repair: re-prompt with the specific error
      if (repairTurns < MAX_REPAIR_TURNS) {
        repairTurns++;
        let errDetail: string;
        if (err instanceof SyntaxError) {
          errDetail = `JSON parse error: ${err.message}. The text I tried to parse was:\n"""\n${jsonStr.slice(0, 500)}\n"""`;
        } else if (err instanceof z.ZodError) {
          errDetail = `Schema validation errors:\n${formatZodErrors(err as z.ZodError)}`;
        } else {
          errDetail = err instanceof Error ? err.message : String(err);
        }
        workingSystem =
          opts.system +
          `\n\nYour previous response was invalid. ${errDetail}\n\nReturn ONLY valid JSON — no markdown, no code fences, no prose. Start your response with "{".`;
        continue;
      }
      // Exhausted repair turns — throw so caller falls back
      throw err;
    }
  }
}
