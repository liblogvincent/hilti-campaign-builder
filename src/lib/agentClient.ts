import type { ArchetypeSelectOutput, AdaptedPlanOutput } from "./agentSchemas";
import type { CampaignArchetype } from "../types";

export async function selectArchetype(brief: string): Promise<ArchetypeSelectOutput> {
  const res = await fetch("/api/archetype-select", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief }),
  });
  if (!res.ok) throw new Error(`archetype-select failed: ${res.status}`);
  return res.json();
}

async function callAdaptPlan(brief: string, pick: { id: string; version?: string }):
  Promise<{ plan: AdaptedPlanOutput; cost_usd: number }> {
  const res = await fetch("/api/adapt-plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief, archetype: pick }),
  });
  if (res.status === 422) {
    const body = await res.json();
    throw new RepairableError(body.errors ?? ["plan failed validation"]);
  }
  if (!res.ok) throw new Error(`adapt-plan failed: ${res.status}`);
  return res.json();
}

class RepairableError extends Error {
  errors: string[];
  constructor(errors: string[]) { super("plan failed validation"); this.errors = errors; }
}

export async function adaptPlanWithRepair(
  brief: string,
  pick: { id: string; version?: string },
  _archetype: CampaignArchetype, // reserved for an optional client-side pre-check
  maxRetries = 2,
): Promise<{ plan: AdaptedPlanOutput; cost_usd: number; repairAttempts: number }> {
  let attempt = 0;
  let workingBrief = brief;
  for (;;) {
    try {
      const out = await callAdaptPlan(workingBrief, pick);
      return { ...out, repairAttempts: attempt };
    } catch (e) {
      if (e instanceof RepairableError && attempt < maxRetries) {
        attempt++;
        workingBrief = `${brief}\n\n[VALIDATION ERRORS TO FIX]\n${e.errors.join("\n")}`;
        continue;
      }
      throw e;
    }
  }
}

import { AGENT_SCHEMA_NAMES } from "./agentSchemas";

export interface ExecuteNodeInput {
  brief: string;
  nodeId: string;
  nodeLabel: string;
  taskType?: string;
  planContext: string;
  schema?: string;
}

export interface ExecuteNodeOutput {
  output: string | Record<string, unknown>;
  cost_usd: number;
}

export async function executeAgentNode(input: ExecuteNodeInput): Promise<ExecuteNodeOutput> {
  const res = await fetch("/api/execute-node", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    throw new RepairableError(body.errors ?? ["schema validation failed"]);
  }
  if (!res.ok) throw new TransportError(`execute-node failed: ${res.status}`, res.status);
  return res.json();
}

class TransportError extends Error {
  status: number;
  constructor(msg: string, status: number) { super(msg); this.status = status; }
}

/** Retry wrapper: transport errors (timeout/429/5xx) get up to maxRetries with exponential backoff.
 *  Schema failures (422) are NOT retried — the LLM produced invalid JSON, fall back immediately. */
export async function executeAgentNodeWithRetry(
  input: ExecuteNodeInput,
  maxRetries = 2,
): Promise<ExecuteNodeOutput & { repairAttempts: number; fell_back: boolean }> {
  let attempt = 0;
  for (;;) {
    try {
      const out = await executeAgentNode(input);
      return { ...out, repairAttempts: attempt, fell_back: false };
    } catch (e) {
      // Schema failures — don't retry, surface immediately
      if (e instanceof RepairableError) {
        return { output: { error: e.errors.join("; "), fallback_reason: "schema_validation_failed" }, cost_usd: 0, repairAttempts: attempt, fell_back: true };
      }
      // Transport errors — retry with backoff
      if (e instanceof TransportError && attempt < maxRetries) {
        attempt++;
        const delay = Math.min(1000 * Math.pow(2, attempt), 4000);
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      // Final failure
      return { output: { error: e instanceof Error ? e.message : "unknown error", fallback_reason: "transport_failure" }, cost_usd: 0, repairAttempts: attempt, fell_back: true };
    }
  }
}

/** Build ExecuteNodeInput with the correct schema name for the node's task_type. */
export function buildExecuteInput(
  brief: string,
  nodeId: string,
  nodeLabel: string,
  taskType: string | undefined,
  planContext: string,
): ExecuteNodeInput {
  return {
    brief,
    nodeId,
    nodeLabel,
    taskType,
    planContext,
    schema: taskType ? AGENT_SCHEMA_NAMES[taskType] : undefined,
  };
}
