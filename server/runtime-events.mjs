const EVENT_TYPES = new Set(["agent_message", "object_patch", "gate_decision", "audit"]);

export function createRuntimeEvent({ type, campaignId, workspace, actor = "panda-runtime", payload = {}, timestamp = new Date().toISOString() }) {
  const normalizedType = EVENT_TYPES.has(type) ? type : "audit";
  return {
    id: eventId(normalizedType),
    type: normalizedType,
    campaignId: typeof campaignId === "string" && campaignId.trim() ? campaignId.trim() : "unknown-campaign",
    workspace: typeof workspace === "string" && workspace.trim() ? workspace.trim() : "global",
    actor: typeof actor === "string" && actor.trim() ? actor.trim() : "panda-runtime",
    timestamp,
    payload: payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {},
  };
}

export function createAgentMessageEvent({ campaignId, workspace, role, text, actor = "panda-agent" }) {
  return createRuntimeEvent({
    type: "agent_message",
    campaignId,
    workspace,
    actor,
    payload: {
      role: role === "user" ? "user" : "agent",
      text: typeof text === "string" ? text.trim().slice(0, 2000) : "",
    },
  });
}

export function createObjectPatchEvent({ campaignId, workspace, objectId, action, note, actor = "panda-agent", patch = {} }) {
  return createRuntimeEvent({
    type: "object_patch",
    campaignId,
    workspace,
    actor,
    payload: {
      objectId: typeof objectId === "string" ? objectId.trim().slice(0, 128) : undefined,
      action: typeof action === "string" ? action.trim().slice(0, 128) : "update",
      note: typeof note === "string" ? note.trim().slice(0, 500) : "",
      patch: patch && typeof patch === "object" && !Array.isArray(patch) ? patch : {},
    },
  });
}

export function createObjectRevisionRecord({
  campaignId,
  objectId,
  objectType,
  action,
  before,
  after,
  rationale,
  actor = "panda-agent",
  createdAt = new Date().toISOString(),
}) {
  return {
    campaignId,
    objectId: typeof objectId === "string" ? objectId.trim().slice(0, 128) : "unknown-object",
    objectType: typeof objectType === "string" ? objectType.trim().slice(0, 64) : "unknown-object-type",
    action: typeof action === "string" ? action.trim().slice(0, 128) : "update",
    before,
    after,
    rationale: typeof rationale === "string" ? rationale.trim().slice(0, 500) : "",
    actor: typeof actor === "string" && actor.trim() ? actor.trim().slice(0, 128) : "panda-agent",
    createdAt,
  };
}

export function createGateDecisionEvent({ campaignId, gateId, decision, reviewer, comment = "" }) {
  return createRuntimeEvent({
    type: "gate_decision",
    campaignId,
    workspace: "gates",
    actor: typeof reviewer === "string" && reviewer.trim() ? reviewer.trim() : "human-reviewer",
    payload: {
      gateId: typeof gateId === "string" ? gateId.trim().slice(0, 32) : "unknown-gate",
      decision: decision === "approved" || decision === "revision-requested" ? decision : "revision-requested",
      comment: typeof comment === "string" ? comment.trim().slice(0, 1000) : "",
    },
  });
}

function eventId(type) {
  if (globalThis.crypto?.randomUUID) return `${type}_${globalThis.crypto.randomUUID()}`;
  return `${type}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
