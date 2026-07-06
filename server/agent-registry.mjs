const AGENTS = {
  "home-orchestrator": {
    id: "home-orchestrator",
    label: "Home Panda Orchestrator",
    schemaName: "orchestrator.answer.v1",
    allowedActions: ["ask_brief_question", "create_campaign_when_ready", "route_to_workspace", "explain_status"],
  },
  "campaign-planning-specialist": {
    id: "campaign-planning-specialist",
    label: "Campaign Planning Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["update_planning_object", "summarize_h1_plan", "apply_leadership_feedback", "find_h1_gaps"],
  },
  "content-planning-specialist": {
    id: "content-planning-specialist",
    label: "Content Planning Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["update_content_requirements", "check_figma_mapping", "find_locale_gaps", "summarize_h2_inputs"],
  },
  "content-specialist": {
    id: "content-specialist",
    label: "Content Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["revise_content_object", "comment_on_object", "prepare_h2_evidence"],
  },
  "rollout-specialist": {
    id: "rollout-specialist",
    label: "Rollout Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["update_rollout_lane", "find_connector_gaps", "prepare_h3_evidence"],
  },
  "optimize-specialist": {
    id: "optimize-specialist",
    label: "Optimize Specialist",
    schemaName: "workspace.answer.v1",
    allowedActions: ["summarize_performance", "recommend_optimization", "promote_learning_candidate"],
  },
};

const ROLE_TO_ID = {
  "orchestrator": "home-orchestrator",
  "campaign-planning-specialist": "campaign-planning-specialist",
  "content-planning-specialist": "content-planning-specialist",
  "content-specialist": "content-specialist",
  "rollout-specialist": "rollout-specialist",
  "optimize-specialist": "optimize-specialist",
};

const UPDATE_ACTIONS = new Set([
  "update_planning_object",
  "update_content_requirements",
  "update_content_object",
  "update_rollout_lane",
]);

function buildSystemPrompt(agent) {
  const allowed = agent.allowedActions.join(", ");
  const isOrchestrator = agent.id === "home-orchestrator";
  const jsonShape = isOrchestrator
    ? `{"answer": string, "highlights": string[], "suggested_actions": string[], "route": string}`
    : `{"answer": string, "highlights": string[], "suggested_actions": string[], "route": string, "updates": [{"action": "update_planning_object"|"update_content_requirements"|"update_content_object"|"update_rollout_lane", "note": string, "targetId": string, "status": string, "payload": object}]}`;

  const updatesGuidance = isOrchestrator
    ? ""
    : `\nWhen your answer should change workspace objects, include an "updates" array. Each update must have an "action" from: ${[...UPDATE_ACTIONS].join(", ")}. Include a "note" explaining the change. Limit to 8 updates. Do not fabricate updates for unchanged objects.`;

  return `You are Panda, the ${agent.label} for Hilti Agentic E2E.
Your role: ${agent.label}.
Allowed actions: ${allowed}.
Forbidden: do not approve gates, do not authorize spend, do not publish. H3 is the human publish/spend gate.${updatesGuidance}
Return only compact JSON with this shape:
${jsonShape}`;
}

for (const agent of Object.values(AGENTS)) {
  agent.systemPrompt = buildSystemPrompt(agent);
}

/**
 * Resolve an agent definition from a scope object or identifier.
 *
 * @param {object|string} scope - Agent scope from the client, an agent id string,
 *   or an object with `id`, `role`, or `view` fields.
 * @returns {{ id: string, label: string, systemPrompt: string, allowedActions: string[], schemaName: string }}
 */
export function getAgentDefinition(scope) {
  if (!scope) return AGENTS["home-orchestrator"];

  // Direct id match
  if (typeof scope === "string") {
    return AGENTS[scope] || AGENTS["home-orchestrator"];
  }

  // Match by id field
  if (scope.id && AGENTS[scope.id]) {
    return AGENTS[scope.id];
  }

  // Match by role field (client-side PandaAgentScope uses role)
  if (scope.role && ROLE_TO_ID[scope.role]) {
    return AGENTS[ROLE_TO_ID[scope.role]];
  }

  // Fallback: route by view
  if (scope.view || scope.surface) {
    const view = scope.view || scope.surface;
    if (view === "campaign-planning") return AGENTS["campaign-planning-specialist"];
    if (view === "content-planning") return AGENTS["content-planning-specialist"];
    if (view === "content") return AGENTS["content-specialist"];
    if (view === "rollout") return AGENTS["rollout-specialist"];
    if (view === "optimize") return AGENTS["optimize-specialist"];
  }

  return AGENTS["home-orchestrator"];
}
