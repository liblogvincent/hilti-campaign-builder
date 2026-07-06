import { assertAgentAction, assertRuntimeStatus } from "./runtime-schema.mjs";
import { createObjectPatchEvent, createObjectRevisionRecord } from "./runtime-events.mjs";

export async function executeRuntimeAction({ action, campaignId, workspace, actor, supabase, fixtureSnapshot }) {
  if (!action || typeof action !== "object") {
    throw new Error("Runtime action is required");
  }

  assertAgentAction(action.action);

  const normalizedAction = {
    ...action,
    note: typeof action.note === "string" ? action.note : "",
    targetId: typeof action.targetId === "string" ? action.targetId.trim() : undefined,
    status: typeof action.status === "string" ? action.status.trim() : undefined,
    payload: isPlainObject(action.payload) ? action.payload : {},
  };

  if (!supabase) {
    return executeFixtureAction({
      action: normalizedAction,
      campaignId,
      workspace,
      actor,
      snapshot: normalizeFixtureSnapshot(fixtureSnapshot),
    });
  }

  return executeSupabaseAction({
    action: normalizedAction,
    campaignId,
    workspace,
    actor,
    supabase,
  });
}

function executeFixtureAction({ action, campaignId, workspace, actor, snapshot }) {
  if (action.action === "update_campaign_plan") {
    const before = snapshot.plan;
    if (!before) return { snapshot, revisions: [], events: [] };

    const after = patchCampaignPlan(before, action.payload);
    const nextSnapshot = { ...snapshot, plan: after };

    return {
      snapshot: nextSnapshot,
      revisions: [
        createObjectRevisionRecord({
          campaignId,
          objectId: "campaign-plan",
          objectType: "campaign_plan",
          action: action.action,
          before,
          after,
          rationale: action.note,
          actor,
        }),
      ],
      events: [
        createObjectPatchEvent({
          campaignId,
          workspace,
          objectId: "campaign-plan",
          action: action.action,
          note: action.note,
          actor,
          patch: action.payload,
        }),
      ],
    };
  }

  if (action.action === "update_planning_object") {
    const targetId = action.targetId;
    if (!targetId) return { snapshot, revisions: [], events: [] };

    const beforeObject = snapshot.workObjects.find((item) => item.id === targetId);
    if (!beforeObject) return { snapshot, revisions: [], events: [] };

    const afterObject = patchPlanningObject(beforeObject, action.payload, action);
    const nextSnapshot = {
      ...snapshot,
      workObjects: snapshot.workObjects.map((item) => (item.id === targetId ? afterObject : item)),
    };

    return {
      snapshot: nextSnapshot,
      revisions: [
        createObjectRevisionRecord({
          campaignId,
          objectId: targetId,
          objectType: "work_object",
          action: action.action,
          before: beforeObject,
          after: afterObject,
          rationale: action.note,
          actor,
        }),
      ],
      events: [
        createObjectPatchEvent({
          campaignId,
          workspace,
          objectId: targetId,
          action: action.action,
          note: action.note,
          actor,
          patch: action.payload,
        }),
      ],
    };
  }

  if (action.action === "update_content_requirements") {
    if (Array.isArray(action.payload.requirements)) {
      const before = snapshot.contentRequirements;
      const after = action.payload.requirements.map((item) => normalizeFixtureContentRequirement(item));
      const nextSnapshot = { ...snapshot, contentRequirements: after };

      return {
        snapshot: nextSnapshot,
        revisions: [
          createObjectRevisionRecord({
            campaignId,
            objectId: "content-requirements",
            objectType: "content_requirement_collection",
            action: action.action,
            before,
            after,
            rationale: action.note,
            actor,
          }),
        ],
        events: [
          createObjectPatchEvent({
            campaignId,
            workspace,
            objectId: "content-requirements",
            action: action.action,
            note: action.note,
            actor,
            patch: { requirements: after },
          }),
        ],
      };
    }

    const targetId = action.targetId;
    if (!targetId) return { snapshot, revisions: [], events: [] };

    const beforeRequirement = snapshot.contentRequirements.find((item) => item.id === targetId);
    if (!beforeRequirement) return { snapshot, revisions: [], events: [] };

    const afterRequirement = patchContentRequirement(beforeRequirement, action.payload, action);
    const nextSnapshot = {
      ...snapshot,
      contentRequirements: snapshot.contentRequirements.map((item) => (item.id === targetId ? afterRequirement : item)),
    };

    return {
      snapshot: nextSnapshot,
      revisions: [
        createObjectRevisionRecord({
          campaignId,
          objectId: targetId,
          objectType: "content_requirement",
          action: action.action,
          before: beforeRequirement,
          after: afterRequirement,
          rationale: action.note,
          actor,
        }),
      ],
      events: [
        createObjectPatchEvent({
          campaignId,
          workspace,
          objectId: targetId,
          action: action.action,
          note: action.note,
          actor,
          patch: action.payload,
        }),
      ],
    };
  }

  return { snapshot, revisions: [], events: [] };
}

async function executeSupabaseAction({ action, campaignId, workspace, actor, supabase }) {
  if (action.action === "update_campaign_plan") {
    const { data: currentPlans, error: planError } = await supabase
      .from("campaign_plans")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false })
      .limit(1);
    if (planError) throw planError;

    const current = currentPlans?.[0];
    if (!current) throw new Error(`Campaign plan not found for campaign ${campaignId}`);

    const after = patchCampaignPlanRow(current, action.payload, actor);
    const next = {
      ...after,
      version: Number(current.version || 1) + 1,
      updated_by: actor,
      updated_at: new Date().toISOString(),
    };
    delete next.id;

    const { error: insertError } = await supabase.from("campaign_plans").insert(next);
    if (insertError) throw insertError;

    const event = createObjectPatchEvent({
      campaignId,
      workspace,
      objectId: "campaign-plan",
      action: action.action,
      note: action.note,
      actor,
      patch: action.payload,
    });
    await persistRevisionAndEvent({
      supabase,
      campaignId,
      objectId: "campaign-plan",
      objectType: "campaign_plan",
      action,
      before: current,
      after: next,
      actor,
      event,
    });
    return { snapshot: undefined, revisions: [], events: [event] };
  }

  if (action.action === "update_planning_object") {
    const targetId = action.targetId;
    if (!targetId) throw new Error("Planning object updates require a targetId");

    const { data: current, error: currentError } = await supabase
      .from("work_objects")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("id", targetId)
      .single();
    if (currentError) throw currentError;

    const next = patchPlanningObjectRow(current, action.payload, action, actor);
    const { error: updateError } = await supabase
      .from("work_objects")
      .update({
        title: next.title,
        lane: next.lane,
        owner_role: next.owner_role,
        status: next.status,
        copy: next.copy,
        evidence: next.evidence,
        source: next.source,
        updated_by: next.updated_by,
        updated_at: next.updated_at,
      })
      .eq("campaign_id", campaignId)
      .eq("id", targetId);
    if (updateError) throw updateError;

    const event = createObjectPatchEvent({
      campaignId,
      workspace,
      objectId: targetId,
      action: action.action,
      note: action.note,
      actor,
      patch: action.payload,
    });
    await persistRevisionAndEvent({
      supabase,
      campaignId,
      objectId: targetId,
      objectType: "work_object",
      action,
      before: current,
      after: next,
      actor,
      event,
    });
    return { snapshot: undefined, revisions: [], events: [event] };
  }

  if (action.action === "update_content_requirements") {
    if (Array.isArray(action.payload.requirements)) {
      const { data: currentRows, error: currentError } = await supabase
        .from("content_requirements")
        .select("*")
        .eq("campaign_id", campaignId);
      if (currentError) throw currentError;

      const nextRows = action.payload.requirements.map((item) => toContentRequirementRow(item, campaignId, actor));
      const currentIds = Array.isArray(currentRows) ? currentRows.map((row) => row?.id).filter(stringValue) : [];
      const incomingIds = new Set(nextRows.map((row) => row.id));
      const idsToDelete = currentIds.filter((id) => !incomingIds.has(id));

      if (nextRows.length === 0) {
        let deleteQuery = supabase.from("content_requirements").delete().eq("campaign_id", campaignId);
        const { error: deleteError } = await deleteQuery;
        if (deleteError) throw deleteError;
      } else if (idsToDelete.length > 0) {
        let deleteQuery = supabase.from("content_requirements").delete().eq("campaign_id", campaignId).in("id", idsToDelete);
        const { error: deleteError } = await deleteQuery;
        if (deleteError) throw deleteError;
      }

      if (nextRows.length > 0) {
        const { error: upsertError } = await supabase.from("content_requirements").upsert(nextRows, { onConflict: "campaign_id,id" });
        if (upsertError) throw upsertError;
      }

      const event = createObjectPatchEvent({
        campaignId,
        workspace,
        objectId: "content-requirements",
        action: action.action,
        note: action.note,
        actor,
        patch: { requirements: action.payload.requirements },
      });
      await persistRevisionAndEvent({
        supabase,
        campaignId,
        objectId: "content-requirements",
        objectType: "content_requirement_collection",
        action,
        before: currentRows ?? [],
        after: nextRows,
        actor,
        event,
      });
      return { snapshot: undefined, revisions: [], events: [event] };
    }

    const targetId = action.targetId;
    if (!targetId) throw new Error("Content requirement updates require a targetId or requirements array");

    const { data: current, error: currentError } = await supabase
      .from("content_requirements")
      .select("*")
      .eq("campaign_id", campaignId)
      .eq("id", targetId)
      .single();
    if (currentError) throw currentError;

    const next = patchContentRequirementRow(current, action.payload, action, actor);
    const { error: updateError } = await supabase
      .from("content_requirements")
      .update({
        channel: next.channel,
        asset_type: next.asset_type,
        title: next.title,
        locale: next.locale,
        owner_role: next.owner_role,
        rollout_target: next.rollout_target,
        status: next.status,
        evidence: next.evidence,
        updated_by: next.updated_by,
        updated_at: next.updated_at,
      })
      .eq("campaign_id", campaignId)
      .eq("id", targetId);
    if (updateError) throw updateError;

    const event = createObjectPatchEvent({
      campaignId,
      workspace,
      objectId: targetId,
      action: action.action,
      note: action.note,
      actor,
      patch: action.payload,
    });
    await persistRevisionAndEvent({
      supabase,
      campaignId,
      objectId: targetId,
      objectType: "content_requirement",
      action,
      before: current,
      after: next,
      actor,
      event,
    });
    return { snapshot: undefined, revisions: [], events: [event] };
  }

  throw new Error(`Unsupported Supabase action: ${action.action}`);
}

async function persistRevisionAndEvent({ supabase, campaignId, objectId, objectType, action, before, after, actor, event }) {
  const revision = createObjectRevisionRecord({
    campaignId,
    objectId,
    objectType,
    action: action.action,
    before,
    after,
    rationale: action.note,
    actor,
    createdAt: event.timestamp,
  });

  // Without a database RPC/transaction helper, these writes remain sequential.
  // Errors are intentionally surfaced immediately so callers can detect partial
  // persistence and we can swap this helper for a future atomic RPC later.
  const { error: revisionError } = await supabase.from("object_revisions").insert({
    campaign_id: revision.campaignId,
    object_id: revision.objectId,
    object_type: revision.objectType,
    action: revision.action,
    before_data: revision.before,
    after_data: revision.after,
    rationale: revision.rationale,
    actor: revision.actor,
    owner_id: null,
    created_at: revision.createdAt,
  });
  if (revisionError) throw revisionError;

  const { error: eventError } = await supabase.from("runtime_events").insert({
    id: event.id,
    campaign_id: event.campaignId,
    workspace: event.workspace,
    type: event.type,
    actor: event.actor,
    payload: event.payload,
    created_at: event.timestamp,
  });
  if (eventError) throw eventError;
}

function patchCampaignPlan(before, payload) {
  return {
    ...before,
    ...(arrayValue(payload.markets, payload.markets) ? { markets: payload.markets } : {}),
    ...(arrayValue(payload.locales, payload.locales) ? { locales: payload.locales } : {}),
    ...(arrayValue(payload.audience, payload.audience) ? { audience: payload.audience } : {}),
    ...(typeof payload.budget === "string" ? { budget: payload.budget } : {}),
    ...(typeof payload.timeline === "string" ? { timeline: payload.timeline } : {}),
    ...(arrayValue(payload.channels, payload.channels) ? { channels: payload.channels } : {}),
    ...(arrayValue(payload.kpis, payload.kpis) ? { kpis: payload.kpis } : {}),
    ...(arrayValue(payload.assumptions, payload.assumptions) ? { assumptions: payload.assumptions } : {}),
    ...(stringValue(payload.name) ? { name: payload.name } : {}),
    ...(stringValue(payload.heroProduct) ? { heroProduct: payload.heroProduct } : {}),
  };
}

function patchPlanningObject(before, payload, action) {
  return {
    ...before,
    ...(action.status ? { status: assertRuntimeStatus(action.status) } : {}),
    ...(stringValue(payload.title) ? { title: payload.title } : {}),
    ...(stringValue(payload.lane) ? { lane: payload.lane } : {}),
    ...(stringValue(payload.owner) ? { owner: payload.owner } : {}),
    ...(stringValue(payload.ownerRole) ? { owner: payload.ownerRole } : {}),
    ...(stringValue(payload.copy) ? { copy: payload.copy } : {}),
    ...(arrayValue(payload.evidence, payload.evidence) ? { evidence: payload.evidence } : {}),
  };
}

function patchContentRequirement(before, payload, action) {
  return {
    ...before,
    ...(action.status ? { status: assertRuntimeStatus(action.status) } : {}),
    ...(stringValue(payload.channel) ? { channel: payload.channel } : {}),
    ...(stringValue(payload.assetType) ? { assetType: payload.assetType } : {}),
    ...(stringValue(payload.title) ? { title: payload.title } : {}),
    ...(stringValue(payload.locale) ? { locale: payload.locale } : {}),
    ...(stringValue(payload.owner) ? { owner: payload.owner } : {}),
    ...(stringValue(payload.ownerRole) ? { owner: payload.ownerRole } : {}),
    ...(stringValue(payload.source) ? { source: payload.source } : {}),
    ...(stringValue(payload.compliance) ? { compliance: payload.compliance } : {}),
    ...(stringValue(payload.rolloutTarget) ? { rolloutTarget: payload.rolloutTarget } : {}),
    ...(arrayValue(payload.evidence, payload.evidence) ? { evidence: payload.evidence } : {}),
    ...(stringValue(payload.updatedBy) ? { updatedBy: payload.updatedBy } : {}),
  };
}

function patchCampaignPlanRow(current, payload, actor) {
  const now = new Date().toISOString();
  return {
    ...current,
    ...(arrayValue(payload.markets, payload.markets) ? { markets: payload.markets } : {}),
    ...(arrayValue(payload.locales, payload.locales) ? { locales: payload.locales } : {}),
    ...(arrayValue(payload.audience, payload.audience) ? { audience: payload.audience } : {}),
    ...(typeof payload.budget === "string" ? { budget: payload.budget } : {}),
    ...(typeof payload.timeline === "string" ? { timeline: payload.timeline } : {}),
    ...(arrayValue(payload.channels, payload.channels) ? { channels: payload.channels } : {}),
    ...(arrayValue(payload.kpis, payload.kpis) ? { kpis: payload.kpis } : {}),
    ...(arrayValue(payload.assumptions, payload.assumptions) ? { assumptions: payload.assumptions } : {}),
    ...(stringValue(payload.name) ? { name: payload.name } : {}),
    ...(stringValue(payload.heroProduct) ? { hero_product: payload.heroProduct } : stringValue(payload.hero_product) ? { hero_product: payload.hero_product } : {}),
    updated_by: actor,
    updated_at: now,
  };
}

function patchPlanningObjectRow(current, payload, action, actor) {
  const now = new Date().toISOString();
  return {
    ...current,
    ...(stringValue(payload.title) ? { title: payload.title } : {}),
    ...(stringValue(payload.lane) ? { lane: payload.lane } : {}),
    ...(stringValue(payload.ownerRole) ? { owner_role: payload.ownerRole } : {}),
    ...(stringValue(payload.owner) ? { owner_role: payload.owner } : {}),
    ...(action.status ? { status: assertRuntimeStatus(action.status) } : {}),
    ...(stringValue(payload.copy) ? { copy: payload.copy } : {}),
    ...(arrayValue(payload.evidence, payload.evidence) ? { evidence: payload.evidence } : {}),
    ...(stringValue(payload.source) ? { source: payload.source } : {}),
    updated_by: actor ?? current.updated_by ?? "panda-runtime",
    updated_at: now,
  };
}

function patchContentRequirementRow(current, payload, action, actor) {
  const now = new Date().toISOString();
  return {
    ...current,
    ...(stringValue(payload.channel) ? { channel: payload.channel } : {}),
    ...(stringValue(payload.assetType) ? { asset_type: payload.assetType } : stringValue(payload.asset_type) ? { asset_type: payload.asset_type } : {}),
    ...(stringValue(payload.title) ? { title: payload.title } : {}),
    ...(stringValue(payload.locale) ? { locale: payload.locale } : {}),
    ...(stringValue(payload.ownerRole) ? { owner_role: payload.ownerRole } : {}),
    ...(stringValue(payload.owner) ? { owner_role: payload.owner } : {}),
    ...(stringValue(payload.source) ? { source: payload.source } : {}),
    ...(action.status ? { status: assertRuntimeStatus(action.status) } : {}),
    ...(stringValue(payload.rolloutTarget) ? { rollout_target: payload.rolloutTarget } : stringValue(payload.rollout_target) ? { rollout_target: payload.rollout_target } : {}),
    ...(arrayValue(payload.evidence, payload.evidence) ? { evidence: payload.evidence } : {}),
    updated_by: actor,
    updated_at: now,
  };
}

function normalizeFixtureSnapshot(snapshot) {
  return {
    campaign: snapshot?.campaign,
    plan: snapshot?.plan,
    workObjects: Array.isArray(snapshot?.workObjects) ? snapshot.workObjects : [],
    contentRequirements: Array.isArray(snapshot?.contentRequirements) ? snapshot.contentRequirements : [],
    gateDecisions: Array.isArray(snapshot?.gateDecisions) ? snapshot.gateDecisions : [],
    events: Array.isArray(snapshot?.events) ? snapshot.events : [],
    agentThreads: Array.isArray(snapshot?.agentThreads) ? snapshot.agentThreads : [],
  };
}

function normalizeFixtureContentRequirement(item) {
  return isPlainObject(item)
    ? {
        ...item,
        evidence: Array.isArray(item.evidence) ? item.evidence : [],
      }
    : item;
}

function toContentRequirementRow(item, campaignId, actor) {
  return {
    id: stringValue(item.id) ? item.id : stringValue(item.targetId) ? item.targetId : "content-requirement",
    campaign_id: campaignId,
    channel: stringValue(item.channel) ? item.channel : "",
    asset_type: stringValue(item.assetType) ? item.assetType : stringValue(item.asset_type) ? item.asset_type : "",
    title: stringValue(item.title) ? item.title : "",
    locale: stringValue(item.locale) ? item.locale : "master",
    owner_role: stringValue(item.ownerRole) ? item.ownerRole : stringValue(item.owner) ? item.owner : "",
    rollout_target: stringValue(item.rolloutTarget)
      ? item.rolloutTarget
      : stringValue(item.rollout_target)
      ? item.rollout_target
      : "",
    status: actionStatus(item) || "draft",
    evidence: Array.isArray(item.evidence) ? item.evidence : [],
    updated_by: stringValue(item.updatedBy) ? item.updatedBy : actor,
    updated_at: new Date().toISOString(),
  };
}

function actionStatus(payload) {
  if (!isPlainObject(payload)) return undefined;
  if (!stringValue(payload.status)) return undefined;
  return assertRuntimeStatus(payload.status);
}

function stringValue(value) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function arrayValue(...values) {
  return values.find((value) => Array.isArray(value));
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
