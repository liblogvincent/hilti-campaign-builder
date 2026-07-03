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
