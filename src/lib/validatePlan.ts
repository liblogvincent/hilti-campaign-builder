import type { CampaignArchetype, ProposedExtra } from "../types";

export interface PlanInput {
  nodes: { id: string; kind: "agent" | "tool" | "gate"; gate?: string; depends_on: string[] }[];
  adaptation_params: Record<string, unknown>;
  proposed_extras?: ProposedExtra[];
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePlanAgainstArchetype(plan: PlanInput, archetype: CampaignArchetype): ValidationResult {
  const errors: string[] = [];
  const nodeIds = plan.nodes.map((n) => n.id);
  const idCounts = new Map<string, number>();
  for (const id of nodeIds) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);

  // Rule 2: step cardinality
  for (const step of archetype.steps) {
    const count = idCounts.get(step.id) ?? 0;
    if (step.cardinality === "exactly_one" && count !== 1) errors.push(`Step "${step.id}" must appear exactly once (found ${count}).`);
    else if (step.cardinality === "one_or_more" && count < 1) errors.push(`Step "${step.id}" must appear at least once.`);
    else if (step.cardinality === "zero_or_one" && count > 1) errors.push(`Step "${step.id}" may appear at most once (found ${count}).`);
  }

  // Rule 1: mandatory gates present + in correct relative order
  const gateSeq = plan.nodes.filter((n) => n.kind === "gate").map((n) => n.gate ?? n.id);
  let cursor = -1;
  for (const g of archetype.mandatory_gates) {
    const idx = gateSeq.indexOf(g, cursor + 1);
    if (idx === -1) errors.push(`Missing mandatory gate "${g}" or it appears out of order.`);
    else cursor = idx;
  }

  // Rule 4: every node not in archetype.steps must be a declared proposed_extra (never silent)
  const declaredExtras = new Set((plan.proposed_extras ?? []).map((e) => e.id));
  const archetypeStepIds = new Set(archetype.steps.map((s) => s.id));
  for (const n of plan.nodes) {
    if (!archetypeStepIds.has(n.id) && !declaredExtras.has(n.id)) {
      errors.push(`Node "${n.id}" is neither an archetype step nor a declared proposed_extra.`);
    }
  }
  for (const e of plan.proposed_extras ?? []) {
    if (!e.rationale?.trim()) errors.push(`Proposed extra "${e.id}" lacks a rationale.`);
    if (!nodeIds.includes(e.after)) errors.push(`Proposed extra "${e.id}" references unknown "after" step "${e.after}".`);
  }

  // Rule 3: adaptation slots
  for (const slot of archetype.adaptation_slots) {
    const raw = plan.adaptation_params[slot.id];
    if (raw === undefined || raw === null) {
      if (slot.required) errors.push(`Required slot "${slot.id}" is missing.`);
      continue;
    }
    const c = slot.constraints;
    if (slot.type === "integer") {
      if (typeof raw !== "number" || !Number.isInteger(raw)) errors.push(`Slot "${slot.id}" must be an integer.`);
      else if (c && ((c.min !== undefined && raw < c.min) || (c.max !== undefined && raw > c.max)))
        errors.push(`Slot "${slot.id}"=${raw} out of bounds [${c.min ?? "-∞"}, ${c.max ?? "+∞"}].`);
    } else if (slot.type === "string_array" || slot.type === "channels" || slot.type === "extra_gates") {
      if (!Array.isArray(raw) || raw.some((x) => typeof x !== "string")) errors.push(`Slot "${slot.id}" must be a string array.`);
      else if (c?.enum) {
        const bad = (raw as string[]).filter((x) => !c.enum!.includes(x));
        if (bad.length) errors.push(`Slot "${slot.id}" has values outside enum: ${bad.join(", ")}.`);
      }
    }
  }

  // Rule 5: DAG — refs resolve + acyclic
  const idSet = new Set(nodeIds);
  for (const n of plan.nodes) for (const d of n.depends_on) if (!idSet.has(d)) errors.push(`Node "${n.id}" depends on unknown node "${d}".`);
  if (!hasCycle(plan.nodes)) errors.push("Plan DAG contains a cycle.");

  return { valid: errors.length === 0, errors };
}

function hasCycle(nodes: PlanInput["nodes"]): boolean {
  const adj = new Map<string, string[]>();
  for (const n of nodes) adj.set(n.id, n.depends_on);
  const WHITE = 0, GRAY = 1, BLACK = 2;
  const color = new Map<string, number>();
  for (const n of nodes) color.set(n.id, WHITE);
  let cyclic = false;
  const dfs = (id: string): void => {
    if (cyclic) return;
    color.set(id, GRAY);
    for (const dep of adj.get(id) ?? []) {
      const dc = color.get(dep);
      if (dc === GRAY) { cyclic = true; return; }
      if (dc === WHITE) dfs(dep);
    }
    color.set(id, BLACK);
  };
  for (const n of nodes) if (color.get(n.id) === WHITE) dfs(n.id);
  return !cyclic; // returns true when ACYCLIC; named hasCycle for rule-5 readability
}
