import type { RunNode } from "../types";
import type { AdaptedPlanOutput, PlanNode } from "./agentSchemas";

export function mapPlanToRunNodes(plan: AdaptedPlanOutput): RunNode[] {
  return plan.nodes.map((n: PlanNode): RunNode => ({
    id: n.id,
    label: n.label,
    kind: n.kind,
    gate: n.gate,
    status: "waiting",
    depends_on: n.depends_on,
    task_id: n.task_type ?? undefined,
    output: null,
    decision: n.kind === "gate" ? null : undefined,
  }));
}
