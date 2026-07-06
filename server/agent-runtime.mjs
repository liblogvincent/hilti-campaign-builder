import { createAgentMessageEvent } from "./runtime-events.mjs";

export function fixtureThreadKey({ campaignId, workspace, agentId }) {
  return `${normalizeKeyPart(campaignId)}:${normalizeKeyPart(workspace)}:${normalizeKeyPart(agentId)}`;
}

export function appendAgentMessageToFixture(store, message) {
  const key = fixtureThreadKey(message);
  const entry = {
    ...message,
    createdAt: new Date().toISOString(),
  };

  store[key] = [...(store[key] || []), entry];
  return store[key].at(-1);
}

export function loadAgentHistoryFromFixture(store, query) {
  return store[fixtureThreadKey(query)] || [];
}

export async function appendAgentMessage({ campaignId, workspace, agentId, role, text, modelMode = "unknown", supabase }) {
  const threadId = await ensureThreadId({ campaignId, workspace, agentId, supabase });
  const { data, error } = await insertAgentMessage({
    supabase,
    threadId,
    role,
    text,
    modelMode,
  });
  if (error) throw error;
  return data;
}

export async function loadAgentHistory({ campaignId, workspace, agentId, supabase, limit = 12 }) {
  const { data: thread, error: threadError } = await supabase
    .from("agent_threads")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("workspace", workspace)
    .eq("agent_id", agentId)
    .maybeSingle();
  if (threadError) throw threadError;
  if (!thread) return [];

  const { data, error } = await supabase
    .from("agent_messages")
    .select("*")
    .eq("thread_id", thread.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return Array.isArray(data) ? [...data].reverse() : [];
}

export async function persistRuntimeEvent({ event, supabase }) {
  const { error } = await supabase.from("runtime_events").insert({
    id: event.id,
    campaign_id: event.campaignId,
    workspace: event.workspace,
    type: event.type,
    actor: event.actor,
    owner_id: event.ownerId ?? event.owner_id ?? null,
    payload: event.payload,
    created_at: event.timestamp,
  });
  if (error) throw error;
}

export async function persistAgentTurn({ campaignId, workspace, agentId, userText, answerText, modelMode = "unknown", supabase }) {
  const threadId = await ensureThreadId({ campaignId, workspace, agentId, supabase });
  const userMessage = await insertAgentMessage({
    supabase,
    threadId,
    role: "user",
    text: userText,
    modelMode: "user",
  });

  const agentMessage = await insertAgentMessage({
    supabase,
    threadId,
    role: "agent",
    text: answerText,
    modelMode,
  });

  const event = createAgentMessageEvent({
    campaignId,
    workspace,
    role: "agent",
    text: answerText,
    actor: agentId,
  });
  await persistRuntimeEvent({ event, supabase });

  return { userMessage, agentMessage, event };
}

async function ensureThreadId({ campaignId, workspace, agentId, supabase }) {
  const { data, error } = await supabase
    .from("agent_threads")
    .upsert({
      campaign_id: campaignId,
      workspace,
      agent_id: agentId,
      visible_to_workspace: true,
      owner_id: null,
    }, { onConflict: "campaign_id,workspace,agent_id" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function insertAgentMessage({ supabase, threadId, role, text, modelMode }) {
  return supabase
    .from("agent_messages")
    .insert({
      thread_id: threadId,
      role,
      text,
      model_mode: modelMode,
      owner_id: null,
    })
    .select("*")
    .single();
}

function normalizeKeyPart(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "unknown";
}
