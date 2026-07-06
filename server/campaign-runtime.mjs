export function createCampaignSnapshotFromFixture({
  run,
  plan,
  planningObjects,
  contentRequirements,
  gateDecisions = [],
  events = [],
  agentThreads = [],
}) {
  return {
    campaign: {
      id: run.campaignId,
      name: run.name,
      brief: run.brief,
      phase: run.phase,
      activeGate: run.currentGate?.id || "H1",
      ownerRole: "Campaign Owner",
      updatedAt: new Date().toISOString(),
    },
    plan,
    workObjects: planningObjects.map((item) => ({
      ...item,
      campaignId: run.campaignId,
      workspace: "campaign-planning",
    })),
    contentRequirements,
    gateDecisions,
    events,
    agentThreads,
  };
}

export async function loadCampaignSnapshot({ campaignId, supabase, fixture }) {
  if (!supabase) return fixture;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (campaignError) throw campaignError;

  const [
    { data: plans, error: planError },
    { data: workObjects, error: workError },
    { data: contentRequirements, error: reqError },
    { data: gateDecisions, error: gateError },
    { data: events, error: eventError },
  ] = await Promise.all([
    supabase.from("campaign_plans").select("*").eq("campaign_id", campaignId).order("version", { ascending: false }).limit(1),
    supabase.from("work_objects").select("*").eq("campaign_id", campaignId),
    supabase.from("content_requirements").select("*").eq("campaign_id", campaignId),
    supabase.from("gate_decisions").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }),
    supabase.from("runtime_events").select("*").eq("campaign_id", campaignId).order("created_at", { ascending: false }).limit(50),
  ]);

  for (const error of [planError, workError, reqError, gateError, eventError]) {
    if (error) throw error;
  }

  return {
    campaign: mapCampaign(campaign),
    plan: mapPlan(plans?.[0]),
    workObjects: Array.isArray(workObjects) ? workObjects.map(mapWorkObject) : [],
    contentRequirements: Array.isArray(contentRequirements) ? contentRequirements.map(mapContentRequirement) : [],
    gateDecisions: Array.isArray(gateDecisions) ? gateDecisions.map(mapGateDecision) : [],
    events: Array.isArray(events) ? events.map(mapRuntimeEvent) : [],
    agentThreads: [],
  };
}

function mapCampaign(row) {
  return {
    id: row.id,
    name: row.name,
    brief: row.brief,
    phase: row.phase,
    activeGate: row.active_gate,
    ownerRole: row.owner_role,
    updatedAt: row.updated_at,
  };
}

function mapPlan(row) {
  if (!row) return undefined;
  return {
    campaignId: row.campaign_id,
    name: row.name,
    heroProduct: row.hero_product,
    markets: row.markets,
    locales: row.locales,
    audience: row.audience,
    budget: row.budget,
    timeline: row.timeline,
    channels: row.channels,
    kpis: row.kpis,
    assumptions: row.assumptions,
  };
}

function mapWorkObject(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    workspace: row.workspace,
    title: row.title,
    lane: row.lane,
    ownerRole: row.owner_role,
    owner: row.owner_role,
    status: row.status,
    gate: row.gate,
    copy: row.copy,
    evidence: row.evidence,
    source: row.source,
    updatedBy: row.updated_by,
    ownerId: row.owner_id,
    updatedAt: row.updated_at,
  };
}

function mapContentRequirement(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    channel: row.channel,
    assetType: row.asset_type,
    title: row.title,
    locale: row.locale,
    ownerRole: row.owner_role,
    owner: row.owner_role,
    rolloutTarget: row.rollout_target,
    status: row.status,
    evidence: row.evidence,
    updatedBy: row.updated_by,
    ownerId: row.owner_id,
    updatedAt: row.updated_at,
    source: "Campaign Runtime",
    compliance: "",
  };
}

function mapGateDecision(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    gateId: row.gate,
    decision: row.decision === "revision-requested" ? "revision_requested" : row.decision,
    reviewer: row.reviewer,
    comment: row.comment,
    artifactsReviewed: [],
    timestamp: row.created_at,
  };
}

function mapRuntimeEvent(row) {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    workspace: row.workspace,
    type: row.type,
    actor: row.actor,
    ownerId: row.owner_id,
    payload: row.payload,
    timestamp: row.created_at,
  };
}
