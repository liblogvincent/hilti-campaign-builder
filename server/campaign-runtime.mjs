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
    workObjects: workObjects || [],
    contentRequirements: contentRequirements || [],
    gateDecisions: gateDecisions || [],
    events: events || [],
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
