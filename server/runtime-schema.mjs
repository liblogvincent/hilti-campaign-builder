export const WORKSPACES = new Set([
  "home",
  "campaign-planning",
  "content-planning",
  "content",
  "rollout",
  "optimize",
  "progress",
  "skills",
]);
export const WORK_OBJECT_STATUSES = new Set(["draft", "in-review", "approved", "revision-requested", "blocked"]);
export const GATES = new Set(["H1", "H2", "H3", "H4", "H-C", "H-legal"]);
export const AGENT_ACTIONS = new Set([
  "update_campaign_plan",
  "update_planning_object",
  "update_content_requirements",
  "update_content_object",
  "update_rollout_lane",
  "create_gate_decision",
]);

export function normalizeWorkspace(value) {
  return WORKSPACES.has(value) ? value : "home";
}

export function assertRuntimeStatus(value) {
  if (!WORK_OBJECT_STATUSES.has(value)) {
    throw new Error(`Invalid runtime status: ${value}`);
  }
  return value;
}

export function assertGate(value) {
  if (!GATES.has(value)) {
    throw new Error(`Invalid gate: ${value}`);
  }
  return value;
}

export function assertAgentAction(value) {
  if (!AGENT_ACTIONS.has(value)) {
    throw new Error(`Invalid agent action: ${value}`);
  }
  return value;
}
