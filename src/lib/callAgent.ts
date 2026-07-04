// Schema-fail self-repair wrapper — mirrors v2 Fourier's llm-call.ts pattern.
// When Output.object() fails to parse the LLM response (common with 580ai proxy),
// re-prompts the model with the validation error so it can self-correct.
// Max 2 repair turns before giving up and throwing.
import { generateText, Output, type LanguageModel } from "ai";
import type { z } from "zod";

const MAX_REPAIR_TURNS = 2;

function isSchemaFail(err: unknown): boolean {
  const msg = err instanceof Error ? `${err.name} ${err.message}` : String(err);
  return /no object generated|schema|validation|failed to parse|invalid.*json/i.test(msg);
}

export interface CallAgentOpts<T> {
  model: LanguageModel;
  schema: z.ZodType<T>;
  system: string;
  prompt: string;
}

export interface CallAgentResult<T> {
  output: T;
  repairTurns: number;
}

/**
 * Call generateText + Output.object() with schema-fail self-repair.
 *
 * On schema_fail: re-prompts the LLM with the exact validation error
 * (max MAX_REPAIR_TURNS). If all repair attempts fail, throws so the
 * caller can fall back to the next model or fixture.
 */
export async function callAgentWithRepair<T>(
  opts: CallAgentOpts<T>,
): Promise<CallAgentResult<T>> {
  let workingSystem = opts.system;
  let repairTurns = 0;

  for (;;) {
    try {
      const { output } = await generateText({
        model: opts.model,
        system: workingSystem,
        prompt: opts.prompt,
        output: Output.object({ schema: opts.schema }),
      });
      return { output: output as T, repairTurns };
    } catch (err) {
      if (isSchemaFail(err) && repairTurns < MAX_REPAIR_TURNS) {
        repairTurns++;
        const errText = err instanceof Error ? err.message : String(err);
        workingSystem =
          opts.system +
          `\n\nYour previous response failed schema validation: ${errText}. Return ONLY valid JSON matching the requested schema — no prose, no code fences.`;
        continue;
      }
      throw err;
    }
  }
}
