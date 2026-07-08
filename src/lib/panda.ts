export type PhaseId = "planning" | "content" | "rollout" | "optimize";
export type Status = "done" | "running" | "blocked" | "queued";
export type GateId = "H1" | "H2" | "H3" | "H4" | "H-C" | "H-legal";
export type AgentMode = "deepseek" | "fixture";
export type AgentWorkMode = "Plan" | "Build";
export type HomePromptMode = "plan" | "create";
export type UrlResearchEvidence = {
  ok: boolean;
  url: string;
  title?: string;
  description?: string;
  summary?: string;
  facts?: string[];
  error?: string;
};

export type HomeCampaignDraft = {
  campaignName: string;
  heroProduct: string;
  objective: string;
  audience: string[];
  markets: string[];
  locales: string[];
  channels: string[];
  kpiCandidates: string[];
  budgetAssumptions: string;
  timingAssumptions: string;
  missingInputs: string[];
  sourceEvidence: string[];
};

export type HomeDraftResponse = {
  mode: AgentMode;
  warning?: string;
  answer: string;
  draft: HomeCampaignDraft;
  suggested_actions: string[];
};
export type HomeTurnResponse = HomeDraftResponse & {
  draftPatch?: Partial<HomeCampaignDraft>;
  intent?: string;
};
export type AppView =
  | "home"
  | "progress"
  | "campaign-planning"
  | "content-planning"
  | "content"
  | "rollout"
  | "optimize"
  | "skills";

export function mergeHomeDraft(base: HomeCampaignDraft, patch?: Partial<HomeCampaignDraft>): HomeCampaignDraft {
  if (!patch) return base;
  return {
    campaignName: homeStringPatch(patch.campaignName, base.campaignName),
    heroProduct: homeStringPatch(patch.heroProduct, base.heroProduct),
    objective: homeStringPatch(patch.objective, base.objective),
    audience: homeArrayPatch(patch.audience, base.audience),
    markets: homeArrayPatch(patch.markets, base.markets),
    locales: homeArrayPatch(patch.locales, base.locales),
    channels: homeArrayPatch(patch.channels, base.channels),
    kpiCandidates: homeArrayPatch(patch.kpiCandidates, base.kpiCandidates),
    budgetAssumptions: homeStringPatch(patch.budgetAssumptions, base.budgetAssumptions),
    timingAssumptions: homeStringPatch(patch.timingAssumptions, base.timingAssumptions),
    missingInputs: homeArrayPatch(patch.missingInputs, base.missingInputs),
    sourceEvidence: homeArrayPatch(patch.sourceEvidence, base.sourceEvidence),
  };
}

export function homeDraftQuestionAnswer(question: string, draft: HomeCampaignDraft): string {
  const lower = question.toLowerCase();
  if (lower.includes("assumption")) {
    return [
      "Here are the working assumptions in the draft:",
      `Product focus: ${draft.heroProduct}.`,
      `Audience: ${draft.audience.join(", ")}.`,
      `Market scope: ${draft.markets.join(", ")}.`,
      `Channels to explore: ${draft.channels.join(", ")}.`,
      `Budget: ${draft.budgetAssumptions}.`,
      `Timing: ${draft.timingAssumptions}.`,
      `Still missing: ${draft.missingInputs.join(", ")}.`,
    ].join("\n");
  }
  if (lower.includes("missing") || lower.includes("input")) {
    return [
      "Here is what I still need or would keep as a working assumption:",
      ...draft.missingInputs.map((item) => `- ${item}`),
      "You can give me any of these details, or I can keep drafting with assumptions and show the campaign plan before creating the workspace.",
    ].join("\n");
  }
  return [
    `The current draft is ${draft.campaignName}.`,
    `Objective: ${draft.objective}`,
    `Product focus: ${draft.heroProduct}.`,
    `Market scope: ${draft.markets.join(", ")}.`,
    "I can revise this here before creating the campaign workspace.",
  ].join("\n");
}

export function createHomeDraftFallback(prompt: string, researchEvidence: UrlResearchEvidence[] = []): HomeCampaignDraft {
  const product = cleanCampaignSubject(extractCampaignSubject(prompt)) || extractProductMention(prompt) || "the product";
  const researched = researchEvidence.filter((item) => item.ok);
  const evidence = researched.flatMap((item) => [
    item.title ? `Page reviewed: ${item.title}.` : undefined,
    item.summary ? `Observed: ${item.summary}` : undefined,
    ...(item.facts?.slice(0, 3) ?? []),
  ]).filter((item): item is string => Boolean(item));
  const globalMarkets = /\b(global|all markets|all the markets|worldwide)\b/i.test(prompt);
  const deferredBudget = /\bbudget\b/i.test(prompt) && /\b(after|defined after|to be defined|later)\b/i.test(prompt);
  return {
    campaignName: sentenceCase(`${product} campaign`),
    heroProduct: product,
    objective: `Create qualified demand for ${product}.`,
    audience: ["Contractors", "Installers", "Trade buyers"],
    markets: globalMarkets ? ["Global markets"] : ["Target markets TBD"],
    locales: globalMarkets ? ["Market-localized variants TBD"] : ["Locale variants TBD"],
    channels: ["Paid Media", "Email", "HOL Landing Page", "Organic/HN"],
    kpiCandidates: ["Qualified HOL visits", "Campaign engagement", "Downstream conversion readiness"],
    budgetAssumptions: deferredBudget ? "To be defined after Campaign Planning and Content Planning review" : "Budget owner and investment range need confirmation",
    timingAssumptions: "Launch timing to be confirmed with campaign owner and market leaders",
    missingInputs: ["Market priority", "Budget owner", "Timing owner", "Claim evidence"],
    sourceEvidence: evidence.length ? evidence.slice(0, 8) : [`User asked for ${product}.`],
  };
}

function homeStringPatch(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function homeArrayPatch(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const items = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  return items.length ? Array.from(new Set(items)) : fallback;
}
export type UserRole =
  | "Campaign Owner"
  | "Paid Media"
  | "Content / Creative"
  | "HOL"
  | "Email TA"
  | "Legal / Compliance"
  | "Leadership / Approver";
export type ArtifactIntegrationMode = "manual" | "file" | "mock" | "MCP" | "API";
export type ArtifactAuthority =
  | "source-of-truth"
  | "draft-write"
  | "publish-held"
  | "read-only-evidence"
  | "manual-review-required";
export type CoverageStatus = "covered" | "partial" | "missing" | "out-of-current-evidence";

export type PandaArtifactMeta = {
  tool: string;
  owner: string;
  integrationMode: ArtifactIntegrationMode;
  authority: ArtifactAuthority;
  gate: GateId;
  evidence: string;
};

export type PandaArtifact = {
  id: string;
  name: string;
  type: string;
  content: string;
  phase: PhaseId;
  createdAt: string;
  data: Record<string, unknown>;
} & Partial<PandaArtifactMeta>;

export type WorklogEntry = {
  id: string;
  agent: string;
  status: Status;
  message: string;
  phase: PhaseId;
  createdAt: string;
};

export type GatePacket = {
  id: GateId;
  recommendation: string;
  risk: "low" | "medium" | "high";
};

export type GateDecision = {
  gateId: GateId;
  decision: "approved" | "revision_requested";
  reviewer: string;
  comment: string;
  artifactsReviewed: string[];
  timestamp: string;
};

export type PandaCampaignSnapshot = {
  campaign?: {
    id: string;
    name: string;
    brief: string;
    phase: PhaseId;
    activeGate: GateId;
    ownerRole: string;
    updatedAt: string;
  };
  plan?: CampaignPlan;
  workObjects?: PlanningWorkObject[];
  contentRequirements?: ContentRequirement[];
  gateDecisions?: GateDecision[];
  events?: Array<Record<string, unknown>>;
  agentThreads?: Array<Record<string, unknown>>;
};

export type PandaAgentResponse = {
  mode: AgentMode;
  warning?: string;
  summary: string;
  worklog: Omit<WorklogEntry, "id" | "phase" | "createdAt">[];
  artifacts: Omit<PandaArtifact, "id" | "phase" | "createdAt">[];
  gate: GatePacket;
  next_actions: string[];
};

export type PandaOrchestratorResponse = {
  mode: AgentMode;
  warning?: string;
  answer: string;
  highlights: string[];
  suggested_actions: string[];
  route?: string;
  updates?: ServerSpecialistUpdate[];
  events?: Array<Record<string, unknown>>;
  snapshot?: PandaCampaignSnapshot;
  snapshot_status?: "unavailable_after_commit";
  no_replay?: boolean;
};

export type CampaignRun = {
  campaignId: string;
  name: string;
  brief: string;
  phase: PhaseId;
  modelMode: AgentMode | "not-run";
  summary: string;
  warning?: string;
  worklog: WorklogEntry[];
  artifacts: PandaArtifact[];
  currentGate?: GatePacket;
  gateDecisions: GateDecision[];
  nextActions: string[];
  updatedAt: string;
  snapshot?: PandaCampaignSnapshot;
};

export type CampaignRuntimeEvent = {
  id: string;
  type: string;
  workspace: string;
  actor: string;
  payload: Record<string, unknown>;
  createdAt?: string;
};

export type CampaignRuntimeSnapshot = {
  campaign: {
    id: string;
    name: string;
    brief: string;
    phase: PhaseId | string;
    activeGate: string;
    ownerRole: UserRole | string;
  };
  plan: CampaignPlan;
  workObjects: PlanningWorkObject[];
  contentRequirements: ContentRequirement[];
  gateDecisions: GateDecision[];
  events: CampaignRuntimeEvent[];
  agentThreads: unknown[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeCampaignSnapshot(raw: unknown): CampaignRuntimeSnapshot {
  const record = isRecord(raw) ? raw : {};
  const campaignRecord = isRecord(record.campaign) ? record.campaign : record;
  const campaign = normalizeCampaignRecord(campaignRecord);
  const plan = normalizeCampaignPlan(record.plan ?? record.campaign_plan, campaign);

  const workObjectsRaw = pickRawArray(record, "workObjects", "work_objects");
  const contentRequirementsRaw = pickRawArray(record, "contentRequirements", "content_requirements");

  return {
    campaign,
    plan,
    workObjects: normalizePlanningWorkObjects(workObjectsRaw, plan),
    contentRequirements: normalizeContentRequirements(contentRequirementsRaw, plan),
    gateDecisions: normalizeGateDecisions(pickRawArray(record, "gateDecisions", "gate_decisions")),
    events: normalizeRuntimeEvents(pickRawArray(record, "events")),
    agentThreads: pickRawArray(record, "agentThreads", "agent_threads") ?? []
  };
}

export function runtimeSnapshotCampaignId(raw: unknown, fallbackCampaignId: string): string {
  const record = isRecord(raw) ? raw : {};
  const campaignRecord = isRecord(record.campaign) ? record.campaign : record;
  const candidate =
    stringValue(campaignRecord.id) ||
    stringValue(campaignRecord.campaignId) ||
    stringValue(campaignRecord.campaign_id) ||
    stringValue(record.campaignId) ||
    stringValue(record.campaign_id);

  return candidate && candidate !== "campaign-unknown" && /^camp_[a-z0-9_-]+$/i.test(candidate)
    ? candidate
    : fallbackCampaignId;
}

export function runtimeSnapshotHasEvidence(raw: unknown): boolean {
  const record = isRecord(raw) ? raw : {};
  return (
    hasRuntimeRecords(record.events, ["id", "type", "actor", "workspace"]) ||
    hasRuntimeRecords(record.workObjects, ["id", "title", "status", "lane"]) ||
    hasRuntimeRecords(record.work_objects, ["id", "title", "status", "lane"]) ||
    hasRuntimeRecords(record.contentRequirements, ["id", "title", "channel", "assetType", "asset_type"]) ||
    hasRuntimeRecords(record.content_requirements, ["id", "title", "channel", "assetType", "asset_type"]) ||
    hasRuntimeRecords(record.gateDecisions, ["gateId", "gate_id", "decision", "reviewer"]) ||
    hasRuntimeRecords(record.gate_decisions, ["gateId", "gate_id", "decision", "reviewer"]) ||
    hasRuntimeRecords(record.agentThreads, ["id", "agentId", "agent_id", "workspace"]) ||
    hasRuntimeRecords(record.agent_threads, ["id", "agentId", "agent_id", "workspace"])
  );
}

export function runtimeSnapshotsFromWorkspace(workspace: CampaignWorkspace) {
  return workspace.campaigns.reduce<Record<string, CampaignRuntimeSnapshot>>((accumulator, campaign) => {
    if (!campaign.snapshot || !runtimeSnapshotHasEvidence(campaign.snapshot)) return accumulator;
    accumulator[campaign.campaignId] = normalizeCampaignSnapshot(campaign.snapshot);
    return accumulator;
  }, {});
}

export function runtimeSnapshotEvidenceFromWorkspace(workspace: CampaignWorkspace) {
  return workspace.campaigns.reduce<Record<string, boolean>>((accumulator, campaign) => {
    if (!campaign.snapshot) return accumulator;
    if (runtimeSnapshotHasEvidence(campaign.snapshot)) {
      accumulator[campaign.campaignId] = true;
    }
    return accumulator;
  }, {});
}

export function shouldSuppressLocalReplay(packet: Pick<PandaOrchestratorResponse, "snapshot" | "no_replay" | "snapshot_status">) {
  return runtimeSnapshotHasEvidence(packet.snapshot) || packet.no_replay || packet.snapshot_status === "unavailable_after_commit";
}

function normalizeCampaignRecord(record: Record<string, unknown>) {
  return {
    id: stringValue(record.id) || stringValue(record.campaignId) || stringValue(record.campaign_id) || "campaign-unknown",
    name: stringValue(record.name) || stringValue(record.campaignName) || stringValue(record.campaign_name) || "Untitled campaign",
    brief: stringValue(record.brief),
    phase: stringValue(record.phase) || "planning",
    activeGate: stringValue(record.activeGate) || stringValue(record.active_gate) || "H1",
    ownerRole: normalizeUserRole(record.ownerRole ?? record.owner_role)
  };
}

function normalizeCampaignPlan(rawPlan: unknown, campaign: CampaignRuntimeSnapshot["campaign"]): CampaignPlan {
  const record = isRecord(rawPlan) ? rawPlan : {};
  const channels = Array.isArray(record.channels) ? normalizeChannels(record.channels) : defaultPlanChannels();
  const brief = campaign.brief || campaign.name;
  return {
    campaignId: stringValue(record.campaignId) || stringValue(record.campaign_id) || campaign.id,
    name: stringValue(record.name) || campaign.name,
    heroProduct: stringValue(record.heroProduct) || stringValue(record.hero_product) || inferHeroProduct(brief),
    markets: stringArray(record.markets, ["DE", "AT", "CH"]),
    locales: stringArray(record.locales, ["de-DE", "de-AT", "de-CH", "fr-CH"]),
    audience: stringArray(record.audience, ["Contractors", "Specifiers"]),
    budget: stringValue(record.budget) || inferBudget(brief),
    timeline: stringValue(record.timeline) || "Q4 launch window; no auto-publish before H3 approval.",
    channels: channels.length ? channels : defaultPlanChannels(),
    kpis: stringArray(record.kpis, ["Qualified HOL visits", "H3 publish readiness without auto-publish"]),
    assumptions: stringArray(record.assumptions, ["Agent-generated plan normalized by Panda."])
  };
}

function normalizePlanningWorkObjects(raw: unknown, plan: CampaignPlan): PlanningWorkObject[] {
  if (!Array.isArray(raw)) return campaignPlanningObjectsFromPlan(plan);
  const normalized = raw.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const lane = normalizePlanningLane(item.lane);
    const title = stringValue(item.title) || `Planning object ${index + 1}`;
    return [
      {
        id: stringValue(item.id) || `planning-object-${index + 1}`,
        title,
        lane,
        owner: normalizePlanningOwner(item.owner, lane),
        status: normalizeWorkObjectStatus(item.status),
        gate: "H1",
        copy: stringValue(item.copy) || `Draft ${title.toLowerCase()} for ${plan.name}.`,
        evidence: stringArray(item.evidence, ["Normalized from Panda runtime snapshot"]),
        source: "CampaignPlan"
      }
    ];
  });
  return normalized.length ? normalized : campaignPlanningObjectsFromPlan(plan);
}

function normalizeContentRequirements(raw: unknown, plan: CampaignPlan): ContentRequirement[] {
  if (!Array.isArray(raw)) return contentRequirementsFromPlan(plan);
  const normalized = raw.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const channel = normalizeRequirementChannel(item.channel);
    const assetType = stringValue(item.assetType) || stringValue(item.asset_type) || "Content asset";
    const locale = stringValue(item.locale) || "master";
    const title = stringValue(item.title) || titleForAsset(plan.heroProduct, channel, assetType);
    return [
      {
        id: stringValue(item.id) || `content-requirement-${index + 1}`,
        channel,
        assetType,
        title,
        locale,
        owner: normalizeOwner(item.owner, channel),
        source: stringValue(item.source) || "Content Planning matrix",
        evidence: stringArray(item.evidence, ["Normalized from Panda runtime snapshot"]),
        compliance:
          stringValue(item.compliance) ||
          (channel === "Claims"
            ? "Requires source-backed claim review before H2."
            : "Requires brand, tone, and locale fit check before H2."),
        rolloutTarget: normalizeRolloutTarget(item.rolloutTarget, channel)
      }
    ];
  });
  return normalized.length ? normalized : contentRequirementsFromPlan(plan);
}

function normalizeGateDecisions(raw: unknown): GateDecision[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const gateId = normalizeGateId(item.gateId ?? item.gate_id ?? item.id);
    return [
      {
        gateId,
        decision: item.decision === "approved" ? "approved" : "revision_requested",
        reviewer: stringValue(item.reviewer) || defaultUserRole,
        comment: stringValue(item.comment) || "Runtime gate decision normalized by Panda.",
        artifactsReviewed: stringArray(item.artifactsReviewed ?? item.artifacts_reviewed, []),
        timestamp: stringValue(item.timestamp) || "1970-01-01T00:00:00.000Z"
      }
    ];
  });
}

function normalizeRuntimeEvents(raw: unknown): CampaignRuntimeEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    const payload = isRecord(item.payload) ? item.payload : {};
    const event: CampaignRuntimeEvent = {
      id: stringValue(item.id) || `event-${index + 1}`,
      type: stringValue(item.type) || "runtime-event",
      workspace: stringValue(item.workspace) || "campaign-planning",
      actor: stringValue(item.actor) || "Panda runtime",
      payload
    };
    const createdAt = stringValue(item.createdAt);
    return [createdAt ? { ...event, createdAt } : event];
  });
}

function normalizeCampaignSnapshotArray<T>(value: unknown): T[] | undefined {
  return Array.isArray(value) ? (value as T[]) : undefined;
}

function pickRawArray(record: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = normalizeCampaignSnapshotArray(record[key]);
    if (value) return value;
  }
  return undefined;
}

function normalizeUserRole(value: unknown): UserRole {
  const text = stringValue(value) as UserRole;
  if (["Campaign Owner", "Paid Media", "Content / Creative", "HOL", "Email TA", "Legal / Compliance", "Leadership / Approver"].includes(text)) {
    return text;
  }
  return defaultUserRole;
}

function normalizePlanningLane(value: unknown): PlanningWorkObject["lane"] {
  const text = stringValue(value).toLowerCase();
  if (text.includes("strategy")) return "Strategy";
  if (text.includes("audience")) return "Audience";
  if (text.includes("analytic")) return "Analytics";
  if (text.includes("media")) return "Media";
  if (text.includes("finance") || text.includes("budget")) return "Finance";
  if (text.includes("pmo") || text.includes("timeline")) return "PMO";
  if (text.includes("risk") || text.includes("legal") || text.includes("compliance")) return "Risk";
  return "Strategy";
}

function normalizePlanningOwner(value: unknown, lane: PlanningWorkObject["lane"]): UserRole {
  const text = stringValue(value) as UserRole;
  if (["Campaign Owner", "Paid Media", "Content / Creative", "HOL", "Email TA", "Legal / Compliance", "Leadership / Approver"].includes(text)) {
    return text;
  }
  if (lane === "Media") return "Paid Media";
  if (lane === "Analytics") return "Leadership / Approver";
  if (lane === "Risk") return "Legal / Compliance";
  return defaultUserRole;
}

function normalizeWorkObjectStatus(value: unknown): WorkObjectStatus {
  const text = stringValue(value);
  if (["draft", "in-review", "approved", "revision-requested", "blocked"].includes(text)) return text as WorkObjectStatus;
  return "draft";
}

function normalizeRequirementChannel(value: unknown): ContentRequirement["channel"] {
  const name = normalizeChannelName(value);
  if (name) return name as ContentRequirement["channel"];
  const text = stringValue(value).toLowerCase();
  if (text.includes("claim")) return "Claims";
  return "Paid Media";
}

function normalizeGateId(value: unknown): GateId {
  const text = stringValue(value);
  if (["H1", "H2", "H3", "H4", "H-C", "H-legal"].includes(text)) return text as GateId;
  return "H1";
}

export type AgentMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  timestamp: string;
};

export type HomeIntent =
  | { type: "chat" }
  | { type: "status" }
  | { type: "plan-campaign" }
  | { type: "create-campaign" }
  | { type: "update-campaign" }
  | { type: "route"; view: AppView };

export type SpecialistAgentUpdate =
  | {
      target: "planning_object";
      id: string;
      patch: Partial<Pick<PlanningWorkObject, "status" | "copy" | "evidence">>;
    }
  | {
      target: "content_requirements";
      action: "replace";
      requirements: ContentRequirement[];
    }
  | {
      target: "rmb_deliverable";
      id: string;
      patch: Partial<Pick<RmbDeliverable, "summary" | "status" | "previewItems" | "artifactDetails" | "discussionNotes" | "workspaceAction">>;
    };

export type SpecialistAgentResponse = {
  answer: string;
  updates: SpecialistAgentUpdate[];
  suggested_actions: string[];
  route?: AppView;
};

export type ServerSpecialistUpdateAction =
  | "update_campaign_plan"
  | "update_planning_object"
  | "update_content_requirements"
  | "update_content_object"
  | "update_rollout_lane";

export type ServerSpecialistUpdate = {
  action: ServerSpecialistUpdateAction;
  targetId?: string;
  status?: WorkObjectStatus;
  note: string;
  payload?: Record<string, unknown>;
};

export type CampaignWorkspace = {
  activeCampaignId: string;
  campaigns: CampaignRun[];
  messages: Record<string, AgentMessage[]>;
};

export type NavigationItem = {
  id: AppView;
  label: string;
};

export type ProgressWorkflowItem = {
  id: AppView;
  label: string;
  gate: GateId;
  status: "done" | "active" | "waiting" | "blocked" | "not-started";
  owner: UserRole;
  nextTask: string;
};

export type CampaignProgress = {
  campaignId: string;
  role: UserRole;
  launchReadiness: number;
  currentPhase: string;
  nextGate: GateId;
  workflowStatus: ProgressWorkflowItem[];
  myTasks: string[];
  teamTasks: Array<{ owner: UserRole; task: string; status: "queued" | "active" | "blocked" }>;
  blockers: string[];
  pandaTasks: string[];
};

export type SkillCapability = {
  id: string;
  name: string;
  category: "knowledge" | "integration";
  status: "active" | "mock" | "needs setup";
  usedBy: Array<"Home" | "Campaign Planning" | "Content Planning" | "Content" | "Rollout" | "Optimize">;
  description: string;
};

export type WorkObjectStatus = "draft" | "in-review" | "approved" | "revision-requested" | "blocked";
export type ContentWorkObject = {
  id: string;
  channel: "Paid Media" | "Organic / HN" | "Email" | "HOL Landing Page" | "Banner" | "Claims";
  type: string;
  title: string;
  owner: UserRole;
  status: WorkObjectStatus;
  gate: "H2";
  copy: string;
  comments: string[];
  evidence: string[];
  actions: Array<"Comment" | "Edit" | "Ask AI to revise" | "Approve" | "Request revision" | "Flag compliance" | "Attach evidence">;
};

export type RmbOutputFormat =
  | "PPTX"
  | "Excel"
  | "Figma mock"
  | "Figma board"
  | "Mapping table"
  | "Contentful preview"
  | "XLS"
  | "Asset manifest"
  | "DAM package"
  | "Compliance report";

export type RmbDeliverable = {
  id: string;
  title: string;
  workspace: "Campaign Planning" | "Content Planning" | "Content";
  gate: GateId;
  owner: UserRole;
  requestedBy: string;
  outputFormats: RmbOutputFormat[];
  sections: string[];
  summary: string;
  previewItems: string[];
  sourceInputs: string[];
  handoffTarget: "Content Planning" | "Content" | "Rollout" | "Leadership" | "DAM / Compliance";
  approvalLevel: "object" | "object-and-final" | "gate";
  status: WorkObjectStatus;
  artifactDetails: Array<{ label: string; value: string }>;
  discussionNotes: string[];
  workspaceAction: string;
};

export function campaignThemeHeadline(heroProduct: string): string {
  const normalized = heroProduct.toLowerCase();
  if (normalized.includes("cold cut")) return "Cut Clean. Cut Fast";
  if (normalized.includes("diamond coring")) return "Core with Confidence";
  if (normalized.includes("te 70") || normalized.includes("rotary hammer") || normalized.includes("heavy")) {
    return "Power Up with Real Power";
  }
  return "Built for the Job";
}

export function campaignThemeForPlan(plan: CampaignPlan): string {
  return `${campaignThemeHeadline(plan.heroProduct)}: ${titleCase(plan.heroProduct)} campaign for ${plan.markets.join(", ")}`;
}

export function artifactRevisionPrompt(deliverable: Pick<RmbDeliverable, "title" | "workspace" | "sections" | "handoffTarget" | "workspaceAction">): string {
  const focus = deliverable.sections.slice(0, 3).join(", ");
  return `Revise ${deliverable.title} in ${deliverable.workspace}. Focus on ${focus}. Keep it ready for ${deliverable.handoffTarget} handoff and explain what changed. ${deliverable.workspaceAction}`;
}

function withRmbDeliverableDefaults(
  items: Array<
    Omit<RmbDeliverable, "summary" | "artifactDetails" | "discussionNotes" | "workspaceAction"> &
      Partial<Pick<RmbDeliverable, "summary" | "artifactDetails" | "discussionNotes" | "workspaceAction">>
  >
): RmbDeliverable[] {
  return items.map((item) => ({
    ...item,
    summary: item.summary ?? item.previewItems[0] ?? item.title,
    artifactDetails: item.artifactDetails ?? [
      { label: "Current output", value: item.previewItems.join(" ") },
      { label: "Sections", value: item.sections.join(", ") },
      { label: "Source inputs", value: item.sourceInputs.join(", ") }
    ],
    discussionNotes: item.discussionNotes ?? [
      `Panda generated this ${item.workspace} artifact from the active campaign context.`,
      `It is ready to review as a ${item.outputFormats.join(" / ")} preview before ${item.handoffTarget} handoff.`
    ],
    workspaceAction: item.workspaceAction ?? `Open and revise ${item.title}`
  }));
}

export type CampaignPlanChannel = {
  id: string;
  name: ContentWorkObject["channel"] | "Banner";
  owner: UserRole;
  objective: string;
  requiredAssets: string[];
  rolloutTarget: "Paid Media" | "Contentful" | "Sprinklr" | "SFMC";
};

export type CampaignPlan = {
  campaignId: string;
  name: string;
  heroProduct: string;
  markets: string[];
  locales: string[];
  audience: string[];
  budget: string;
  timeline: string;
  channels: CampaignPlanChannel[];
  kpis: string[];
  assumptions: string[];
};

export type PlanningWorkObject = {
  id: string;
  title: string;
  lane: "Strategy" | "Audience" | "Analytics" | "Media" | "Finance" | "PMO" | "Risk";
  owner: UserRole;
  status: WorkObjectStatus;
  gate: "H1";
  copy: string;
  evidence: string[];
  source: "CampaignPlan";
};

export type PlanningReadiness = {
  approved: number;
  total: number;
  blocked: number;
  revision: number;
  pct: number;
};

export type GateApprovalReadiness = {
  ready: boolean;
  reason: string;
  approved: number;
  total: number;
};

export type ObjectWorkspaceReadiness = {
  approved: number;
  total: number;
  blocked: number;
  revision: number;
  pct: number;
  channels: string[];
};

export type ContentRequirement = {
  id: string;
  channel: ContentWorkObject["channel"];
  assetType: string;
  title: string;
  locale: "master" | string;
  owner: UserRole;
  source: "Content Planning matrix";
  evidence: string[];
  compliance: string;
  rolloutTarget: CampaignPlanChannel["rolloutTarget"];
};

export type ContentPlanningApprovalStatus = "draft" | "in-review" | "approved" | "revision-requested";

export type CreativeConceptPackage = {
  storyId: "CP1";
  title: string;
  status: ContentPlanningApprovalStatus;
  head: string;
  heart: string;
  hands: string;
  proofPoints: string[];
  visualDirections: string[];
};

export type CrossChannelRequirementsPackage = {
  storyId: "CP2";
  title: string;
  status: ContentPlanningApprovalStatus;
  rows: ContentRequirement[];
  channels: string[];
  productionNotes: string[];
};

export type StoryboardPackage = {
  storyId: "CP3";
  title: string;
  status: ContentPlanningApprovalStatus;
  frames: Array<{ id: string; scene: string; direction: string; channel: string; script: string }>;
  shotlist: string[];
  productionPlan: string[];
};

export type FigmaBoardManifest = {
  storyId: "CP4";
  title: string;
  status: ContentPlanningApprovalStatus;
  mappingStatus: "ready-to-create" | "created" | "needs-revision";
  figmaUrl?: string;
  frames: Array<{ id: string; name: string; channel: string; placeholderCount: number; ratio: string }>;
  actions: string[];
};

export type ContentPlanningBridge = {
  creativeConcept: CreativeConceptPackage;
  requirements: CrossChannelRequirementsPackage;
  storyboard: StoryboardPackage;
  figmaBoard: FigmaBoardManifest;
};

export type ContentPlanningBridgeReadiness = {
  approved: number;
  total: 4;
  readyForH2: boolean;
  pending: string[];
};

export type RolloutWorkObject = {
  id: string;
  lane: "Paid Media" | "Contentful" | "Sprinklr" | "SFMC" | "UTM / QA" | "Publish Readiness";
  title: string;
  owner: UserRole;
  status: WorkObjectStatus;
  gate: "H3";
  sourceContentIds: string[];
  evidence: string[];
  actions: string[];
};

export type RolloutWorkspaceReadiness = {
  approved: number;
  total: number;
  blocked: number;
  revision: number;
  pct: number;
  lanes: RolloutWorkObject["lane"][];
  sourceObjects: number;
};

export type PlanPreviewSlide = {
  kicker: string;
  title: string;
  bullets: string[];
};

export type LeadershipFeedbackChange = {
  id: string;
  action: "add-content-requirement" | "revise-plan-note" | "revise-audience" | "flag-risk";
  label: string;
  detail: string;
};

export type LeadershipFeedbackProposal = {
  summary: string;
  changes: LeadershipFeedbackChange[];
};

export type PandaAgentScope = {
  id: "home-orchestrator" | "campaign-planning-specialist" | "content-planning-specialist" | "content-specialist" | "rollout-specialist" | "optimize-specialist";
  role: "orchestrator" | "campaign-planning-specialist" | "content-planning-specialist" | "content-specialist" | "rollout-specialist" | "optimize-specialist";
  surface: AppView;
  allowed_actions: string[];
  selected_object_id?: string;
};

export type PandaContextPacket = {
  prototype: "panda-v4";
  campaign_id: string;
  campaign_name: string;
  brief: string;
  summary: string;
  current_view: AppView;
  phase: PhaseId;
  current_gate: GateId;
  user_role: UserRole;
  approved_gates: GateId[];
  campaign_plan: CampaignPlan;
  planning_objects: Array<Pick<PlanningWorkObject, "id" | "title" | "lane" | "owner" | "status" | "gate">>;
  content_requirements: Array<Pick<ContentRequirement, "id" | "title" | "channel" | "assetType" | "locale" | "owner" | "rolloutTarget">>;
  content_objects: Array<Pick<ContentWorkObject, "id" | "title" | "channel" | "owner" | "status" | "gate">>;
  rollout_objects: Array<Pick<RolloutWorkObject, "id" | "title" | "lane" | "owner" | "status" | "gate">>;
  artifacts: Array<Pick<PandaArtifact, "name" | "type" | "phase" | "gate">>;
  gate_decisions: GateDecision[];
  worklog: Array<Pick<WorklogEntry, "agent" | "status" | "message" | "phase" | "createdAt">>;
};

export type SkillHubSummary = {
  knowledge: number;
  integrations: number;
  active: number;
  mockOrNeedsSetup: number;
  workflowCoverage: SkillCapability["usedBy"];
};

export const navigationItems: NavigationItem[] = [
  { id: "home", label: "Home" },
  { id: "progress", label: "Progress" },
  { id: "campaign-planning", label: "Campaign Planning" },
  { id: "content-planning", label: "Content Planning" },
  { id: "content", label: "Content" },
  { id: "rollout", label: "Rollout" },
  { id: "optimize", label: "Optimize" },
  { id: "skills", label: "Skills" }
];

export const defaultUserRole: UserRole = "Campaign Owner";

export const phases: Array<{ id: PhaseId; label: string; agents: string; gate: GateId; description: string }> = [
  {
    id: "planning",
    label: "Plan",
    agents: "A0 A1 A2 A3 A4 A5",
    gate: "H1",
    description: "Create the RMB campaign-planning deliverables: MarCom packet, media plan, HOL journey map, email brief, organic/HN strategy, and downstream handoff."
  },
  {
    id: "content",
    label: "Content",
    agents: "CP1 CP2 CP3 CP4 C1 C2 C4",
    gate: "H2",
    description: "Turn the campaign plan into creative direction, channel-by-asset requirements, storyboards, Figma mapping, and content handoff."
  },
  {
    id: "rollout",
    label: "Rollout",
    agents: "R1 R2 R3 R4 R5 R6 R7 R8 R9 R10 R11",
    gate: "H3",
    description: "Build Rollout & Publish Readiness evidence across tools, owners, QA, and held publish candidates."
  },
  {
    id: "optimize",
    label: "Optimize",
    agents: "OPT1 OPT2 OPT3 OPT4 OPT5",
    gate: "H4",
    description: "Create Performance Insights & Optimization recommendations before any knowledge promotion."
  }
];

export type CoverageItem = {
  id: string;
  gate: GateId;
  workstream: "Campaign Planning" | "Content Planning" | "Content Creation" | "Campaign Roll-Out" | "Campaign Optimization";
  name: string;
  requestedOutput: string;
  backlogCoverage: string;
  pandaCoverage: CoverageStatus;
  gap: string;
  owner: string;
  tool: string;
};

export type ToolchainItem = {
  tool: string;
  role: string;
  owner: string;
  integrationMode: ArtifactIntegrationMode;
  authority: ArtifactAuthority;
  gateImpact: string;
  status: "configured" | "mock" | "file" | "MCP-ready" | "read-only" | "verify";
};

export const coverageItems: CoverageItem[] = [
  {
    id: "h1-marcom",
    gate: "H1",
    workstream: "Campaign Planning",
    name: "MarCom Planning",
    requestedOutput: "Campaign concept/theme, objectives/KPIs, hero products, offer, target audience, campaign timeline, channels",
    backlogCoverage: "Covered by Epic 1/A0 + planning stories",
    pandaCoverage: "partial",
    gap: "Needs MarCom plan artifact, not just brief summary",
    owner: "Campaign Planning Owner",
    tool: "PowerPoint / SharePoint"
  },
  {
    id: "h1-paid-media",
    gate: "H1",
    workstream: "Campaign Planning",
    name: "Paid Media Strategy / Media Plan",
    requestedOutput:
      "Platform mix, campaign/ad structure, audiences, keywords, budget split, projected KPIs, asset strategy, testing roadmap",
    backlogCoverage: "Covered by E1-S3/A2",
    pandaCoverage: "partial",
    gap: "Missing keyword plan, testing roadmap, detailed campaign/ad-group/ad plan",
    owner: "Paid Media Team",
    tool: "Excel / Power BI / Ad Platforms"
  },
  {
    id: "h1-hol",
    gate: "H1",
    workstream: "Campaign Planning",
    name: "HOL Customer Journey Mapping",
    requestedOutput: "Customer paths, touchpoints, landing pages, banners, required UX assets",
    backlogCoverage: "Covered by E1-S7/A3",
    pandaCoverage: "missing",
    gap: "Must add HOL journey map artifact",
    owner: "HOL team member",
    tool: "HOL website map / Excel"
  },
  {
    id: "h1-email",
    gate: "H1",
    workstream: "Campaign Planning",
    name: "Email Strategy & TA Brief",
    requestedOutput: "Segments, email count, journey role per email, messaging strategy, testing",
    backlogCoverage: "Covered by E1-S8/A4",
    pandaCoverage: "missing",
    gap: "Must add email strategy artifact",
    owner: "Email strategist / Marketing Cloud member",
    tool: "SFMC / CRM"
  },
  {
    id: "h1-social",
    gate: "H1",
    workstream: "Campaign Planning",
    name: "Organic Social & HN Strategy",
    requestedOutput: "Campaign story, required owned/HN assets, formats/dimensions",
    backlogCoverage: "Covered by E1-S9/A5",
    pandaCoverage: "missing",
    gap: "Must add organic/HN strategy artifact",
    owner: "Social media member / Hilti Network rep",
    tool: "Sprinklr / Figma"
  },
  {
    id: "h2-figma",
    gate: "H2",
    workstream: "Content Planning",
    name: "Figma Mapping Agent",
    requestedOutput: "Figma board with placeholders / structured output",
    backlogCoverage: "Covered by the Figma mapping story",
    pandaCoverage: "missing",
    gap: "Needs Figma board manifest or mock board representation",
    owner: "Designer / Creative Manager / Content Operations",
    tool: "Figma"
  },
  {
    id: "h3-video",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Video Localization",
    requestedOutput: "Translated video files per market",
    backlogCoverage: "Covered by R1",
    pandaCoverage: "missing",
    gap: "Needs localized video asset manifest and translation workflow evidence",
    owner: "Localization support / video production",
    tool: "Transperfect / Adobe"
  },
  {
    id: "h3-static-translation",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Static Asset Translation",
    requestedOutput: "Local market Figma boards with translated static assets",
    backlogCoverage: "Covered by R8",
    pandaCoverage: "partial",
    gap: "Has text-swap UI, but not the full Figma plugin or translation roundtrip",
    owner: "Localization support / design operations",
    tool: "Figma / Transperfect"
  },
  {
    id: "h3-sprinklr",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Sprinklr Bulk Upload",
    requestedOutput: "Organic/HN assets uploaded to Sprinklr as draft posts with copy variations and URLs",
    backlogCoverage: "Covered by E4-S2/R2",
    pandaCoverage: "missing",
    gap: "Needs Sprinklr draft manifest",
    owner: "Social media team member",
    tool: "Sprinklr"
  },
  {
    id: "h3-contentful-banner",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Contentful Banner Builder",
    requestedOutput: "Banners in regional Contentful spaces",
    backlogCoverage: "Covered by R4",
    pandaCoverage: "missing",
    gap: "Needs multi-space banner manifest and build output",
    owner: "HOL team member / Contentful profile",
    tool: "Contentful / Weblate"
  },
  {
    id: "h3-contentful-lp",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "HOL Landing Page Blueprint Creation",
    requestedOutput: "Complete English LP in Contentful aligned to Figma mockup",
    backlogCoverage: "Covered by E4-S3/R3",
    pandaCoverage: "missing",
    gap: "Needs Contentful LP manifest",
    owner: "HOL team member / Contentful profile",
    tool: "Contentful"
  },
  {
    id: "h3-email-build",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Email Build & Translation",
    requestedOutput: "Emails in Marketing Cloud per locale",
    backlogCoverage: "Covered by R6",
    pandaCoverage: "missing",
    gap: "Needs SFMC integration and translation workflow evidence",
    owner: "Email Technical Architect",
    tool: "SFMC / Marketing Cloud"
  },
  {
    id: "h3-email-qa",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Email QA",
    requestedOutput: "QA checklist with pass/fail",
    backlogCoverage: "Covered by R7",
    pandaCoverage: "missing",
    gap: "Needs rendering validation and CTA/link verification evidence",
    owner: "Email Technical Architect",
    tool: "SFMC / Marketing Cloud"
  },
  {
    id: "h3-utm",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "UTM Create + QA",
    requestedOutput: "UTM file ready for implementation",
    backlogCoverage: "Covered by R10",
    pandaCoverage: "partial",
    gap: "Needs exportable UTM file and validation matrix",
    owner: "Media Operations / Paid Media Team",
    tool: "Excel / Ad Platforms"
  },
  {
    id: "h3-contentful-loc",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "HOL Landing Page Translations",
    requestedOutput: "All MO landing pages in Contentful, localized",
    backlogCoverage: "Backlog gap / [VERIFY]: parked in Out-of-Scope & Traceability",
    pandaCoverage: "missing",
    gap: "Needs localized LP manifest and market review status before backlog can claim coverage",
    owner: "HOL team member / Localization support",
    tool: "Contentful / Global Link"
  },
  {
    id: "h3-hol-banner",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "HOL Hardcoded Banner",
    requestedOutput: "Banners published in Weblate",
    backlogCoverage: "Covered by R9",
    pandaCoverage: "missing",
    gap: "Needs Weblate integration and Figma-to-Excel transcription evidence",
    owner: "HOL team member / Localization support",
    tool: "Weblate"
  },
  {
    id: "h3-figma-approval",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Figma Asset Approval",
    requestedOutput: "Market feedback implemented on Figma",
    backlogCoverage: "Post-translation feedback loop",
    pandaCoverage: "missing",
    gap: "Needs comment management and handoff evidence",
    owner: "Designer / Creative Manager",
    tool: "Figma / Jira"
  },
  {
    id: "h3-sfmc",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "SFMC Automation and Journey Build",
    requestedOutput: "Completed SFMC automation and journey",
    backlogCoverage: "Backlog gap / [VERIFY]: E4-S6 covers email build/translation, not full journey configuration",
    pandaCoverage: "missing",
    gap: "Needs SFMC journey manifest or explicit out-of-scope boundary",
    owner: "Email Technical Architect",
    tool: "SFMC / Marketing Cloud"
  },
  {
    id: "h3-paid-build",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Paid Media Campaign Build",
    requestedOutput: "Campaigns/ad groups/ads created with assets, UTMs, URLs, copy, audiences, keywords, naming",
    backlogCoverage: "Covered by E4-S5/R5",
    pandaCoverage: "partial",
    gap: "Needs platform build manifest down to ad level",
    owner: "Paid Media Team",
    tool: "Google Ads / Meta / LinkedIn"
  },
  {
    id: "h3-paid-qa",
    gate: "H3",
    workstream: "Campaign Roll-Out",
    name: "Paid Media QA",
    requestedOutput: "Yes/no implementation column for each campaign attribute",
    backlogCoverage: "Covered by E4-S11/R11",
    pandaCoverage: "partial",
    gap: "Needs attribute matrix against actual build manifest",
    owner: "Paid Media Team",
    tool: "Ad Platforms / Excel"
  },
  {
    id: "h4-paid-opt",
    gate: "H4",
    workstream: "Campaign Optimization",
    name: "Paid Media Performance Optimization",
    requestedOutput: "Suggestions to optimize paid media performance based on performance data vs plan/benchmarks",
    backlogCoverage: "Covered by E5-S1/OPT1",
    pandaCoverage: "missing",
    gap: "Needs performance snapshot and ranked paid-media recommendations",
    owner: "Carine / Paid Media / Data Analytics",
    tool: "Power BI / Ad Platforms"
  },
  {
    id: "h4-lp-opt",
    gate: "H4",
    workstream: "Campaign Optimization",
    name: "HOL Landing Page Optimization",
    requestedOutput: "Suggestions to optimize landing page performance using GA, heat maps, layout/design knowledge, benchmarks",
    backlogCoverage: "Covered by E5-S2/OPT2",
    pandaCoverage: "missing",
    gap: "Needs LP performance insight/recommendation artifact",
    owner: "Adriana / HOL / Web Analytics",
    tool: "Google Analytics / Heat Maps"
  },
  {
    id: "h4-banner-opt",
    gate: "H4",
    workstream: "Campaign Optimization",
    name: "HOL Banner Optimization",
    requestedOutput: "Recommendations on banner types/placements to prioritize, replace, or improve",
    backlogCoverage: "Covered by E5-S3/OPT3",
    pandaCoverage: "missing",
    gap: "Needs banner performance and placement recommendation artifact",
    owner: "Adriana / HOL / Web Analytics",
    tool: "Google Analytics / Heat Maps"
  }
];

export const toolchainItems: ToolchainItem[] = [
  {
    tool: "Figma",
    role: "Creative boards, placeholders, paid/social/HN assets, LP/email/banner mockups, local-market boards, review comments",
    owner: "Content Dev / Design / Content Operations",
    integrationMode: "MCP",
    authority: "source-of-truth",
    gateImpact: "H2 source evidence; H3 localization and final asset approval evidence",
    status: "MCP-ready"
  },
  {
    tool: "Content Hub / DAM",
    role: "Asset storage, metadata, image ids/links for downstream build and compliance",
    owner: "Content Operations",
    integrationMode: "mock",
    authority: "source-of-truth",
    gateImpact: "H2 asset evidence; H3 build references",
    status: "mock"
  },
  {
    tool: "Contentful",
    role: "HOL landing page and banner build, localization in regional spaces",
    owner: "HOL team member / Contentful profile",
    integrationMode: "mock",
    authority: "publish-held",
    gateImpact: "H3 LP/banner build and QA evidence",
    status: "mock"
  },
  {
    tool: "Sprinklr",
    role: "Organic/HN bulk upload and draft posts",
    owner: "Social media team member",
    integrationMode: "file",
    authority: "draft-write",
    gateImpact: "H3 social/HN rollout evidence",
    status: "file"
  },
  {
    tool: "Google Ads / Meta / LinkedIn",
    role: "Paid campaign build, QA, and performance data",
    owner: "Paid Media Team",
    integrationMode: "file",
    authority: "publish-held",
    gateImpact: "H3 paid-media build/QA; H4 paid-media optimization",
    status: "file"
  },
  {
    tool: "SFMC / Marketing Cloud",
    role: "Email preview, basefile upload, automation/journey, local email builds",
    owner: "Email Technical Architect",
    integrationMode: "mock",
    authority: "publish-held",
    gateImpact: "H3 email build evidence; SFMC journey may be separate story",
    status: "verify"
  },
  {
    tool: "Weblate / Transperfect / Global Link",
    role: "Translation roundtrips for static/video/email/LP/banner assets",
    owner: "Localization support / local reviewers",
    integrationMode: "manual",
    authority: "manual-review-required",
    gateImpact: "H3/H-loc localization evidence",
    status: "verify"
  },
  {
    tool: "Power BI",
    role: "Paid-media performance data and benchmarks",
    owner: "Paid Media / Data Analytics",
    integrationMode: "API",
    authority: "read-only-evidence",
    gateImpact: "H4 paid-media optimization",
    status: "read-only"
  },
  {
    tool: "Google Analytics / GA4",
    role: "HOL LP/banner interaction data",
    owner: "HOL / Web Analytics",
    integrationMode: "API",
    authority: "read-only-evidence",
    gateImpact: "H4 HOL LP/banner optimization",
    status: "read-only"
  },
  {
    tool: "Microsoft Teams / Astra Gates",
    role: "Human approval surface",
    owner: "M2F / Astra platform",
    integrationMode: "MCP",
    authority: "manual-review-required",
    gateImpact: "All gates; especially H3 no-auto-publish rule",
    status: "MCP-ready"
  }
];

export function artifactMetadataComplete(artifact: PandaArtifact) {
  return Boolean(artifact.tool && artifact.owner && artifact.integrationMode && artifact.authority && artifact.gate && artifact.evidence);
}

export function coverageStats(items: CoverageItem[]) {
  return items.reduce(
    (stats, item) => {
      stats[item.pandaCoverage] += 1;
      return stats;
    },
    { covered: 0, partial: 0, missing: 0, "out-of-current-evidence": 0 } as Record<CoverageStatus, number>
  );
}

export function displayCampaignSummary(summary: string) {
  const trimmed = summary.trim();
  if (!trimmed) return "Panda is ready to inspect the campaign and recommend the next action.";
  try {
    const parsed = JSON.parse(trimmed) as { summary?: unknown };
    if (typeof parsed.summary === "string" && parsed.summary.trim()) return parsed.summary.trim();
  } catch {
    const unescaped = trimmed.replace(/\\"/g, "\"");
    try {
      const parsed = JSON.parse(unescaped) as { summary?: unknown };
      if (typeof parsed.summary === "string" && parsed.summary.trim()) return parsed.summary.trim();
    } catch {
      const summaryMatch = unescaped.match(/"summary"\s*:\s*"([^"]+)"/);
      if (summaryMatch?.[1]) return summaryMatch[1].trim();
    }
    return trimmed;
  }
  return trimmed;
}

export function agentModeForPhase(phase: PhaseId): AgentWorkMode {
  return phase === "planning" ? "Plan" : "Build";
}

export function classifyHomeIntent(prompt: string): HomeIntent {
  const text = prompt.trim().toLowerCase();
  const textWithoutUrls = stripUrls(text).trim();
  if (!text) return { type: "chat" };
  const route = routeIntent(textWithoutUrls);
  if (route) return { type: "route", view: route };
  if (/\b(status|progress|blocked|blocker|missing|ready|where are we)\b/.test(text)) return { type: "status" };

  const productMatch = extractProductMention(prompt);
  const hasProduct = Boolean(productMatch);
  const hasCampaignWord = /\bcampaign\b/.test(text);
  const startsNewCampaignRequest =
    /\b(i\s+(want|need|would like)|start|launch|create|plan|build)\b[\s\S]{0,120}\bcampaign\b/.test(text) ||
    /\bcampaign\s+(for|of|about)\b/.test(text);

  if (!hasProduct && !hasCampaignWord) return { type: "chat" };
  if (!startsNewCampaignRequest && /\b(update|change|revise|adjust|edit)\b/.test(text) && /\b(campaign|plan|planning|brief|objective|audience|kpi|budget|channel)\b/.test(text)) {
    return { type: "update-campaign" };
  }

  const hasCreationVerb = /\b(create|start|launch|build|plan)\b/.test(text);
  if (!hasCreationVerb) return { type: "plan-campaign" };

  const hasAudience = /\b(contractor|installer|specifier|mocn|audience|segment|persona)\b/i.test(text);
  const hasMarket = /\b(dach|germany|austria|switzerland|de|at|ch|eu|market|region)\b/i.test(text);
  const hasChannel = /\b(email|paid|social|sprinklr|contentful|hol|linkedin|google|meta)\b/i.test(text);
  const hasBudgetOrTiming = /\b(budget|eur|euro|q[1-4]|launch|timeline|date|week|month)\b/i.test(text);
  const signalCount = [hasProduct, hasAudience, hasMarket, hasChannel, hasBudgetOrTiming].filter(Boolean).length;

  if (signalCount >= 3) return { type: "create-campaign" };
  return { type: "plan-campaign" };
}

export function buildHomeCampaignDiscoveryReply(prompt: string, researchEvidence: UrlResearchEvidence[] = []) {
  const product = extractProductMention(prompt) || cleanCampaignSubject(extractCampaignSubject(prompt)) || "the product";
  const sources = extractSourceUrls(prompt);
  const researched = researchEvidence.filter((item) => item.ok);
  const researchLines = researched.flatMap((item) => [
    item.title ? `Page reviewed: ${item.title}.` : undefined,
    item.summary ? `What Panda observed: ${item.summary}` : undefined,
    ...(item.facts?.slice(0, 4).map((fact) => `Evidence: ${fact}`) ?? [])
  ]).filter(Boolean);
  const markets = /\b(global|all markets|all the markets|worldwide)\b/i.test(prompt)
    ? "Global markets, with market-leader review before final country prioritization"
    : "Target markets/locales still need confirmation";
  const budget = /\bbudget\b/i.test(prompt)
    ? "Budget to be defined after Campaign Planning and Content Planning are shared with leadership and market leaders"
    : "Budget still needs owner input";
  const channels = inferHomeBriefChannels(prompt);
  return [
    `I can shape this before creating the workspace. Here is a first version for you to review.`,
    `Initial brief for review`,
    `Campaign idea: ${product} launch campaign.`,
    sources.length ? `Source evidence: ${sources.join(", ")}.` : "Source evidence: product page, product docs, or brand playbook still needed.",
    ...(researchLines.length ? [`Panda researched the linked page before drafting.`, ...researchLines.slice(0, 6)] : []),
    `Market scope: ${markets}.`,
    `Audience starting point: contractors, installers, and trade buyers. This can be refined with audience files or market feedback.`,
    `${budget}.`,
    `Initial plan to review`,
    `Campaign Planning should confirm the objective, markets, success-measure ownership, budget logic, timing, and channels before anything is treated as final.`,
    `Suggested first channel mix: ${channels}.`,
    `Content Planning should turn the approved direction into a channel-by-asset matrix, including Figma mapping and locale needs.`,
    `Content and Rollout can start from draft assumptions, but Panda should keep changes visible so later leadership or market input can update the plan cleanly.`,
    `If this direction looks right, switch to Create and say "proceed". I will create the Campaign Planning draft for review.`
  ].join("\n\n");
}

export function homeContinuationInstruction(prompt: string, recentAgentText: string): string | undefined {
  const text = prompt.trim().toLowerCase();
  const previous = recentAgentText.trim().toLowerCase();
  const confirmsProceed = /\b(proceed|go ahead|continue|do it|yes|please draft|draft the rest|as you recommend|recommend)\b/.test(text);
  const previousWasH1Planning =
    previous.includes("missing inputs") ||
    previous.includes("channel strategy") ||
    previous.includes("h1 plan") ||
    previous.includes("h1 planning") ||
    previous.includes("planning objects") ||
    previous.includes("initial plan to review") ||
    previous.includes("campaign planning draft");
  if (!confirmsProceed || !previousWasH1Planning) return undefined;
  return "draft remaining H1 planning objects: Missing Inputs, Channel Strategy, Budget Allocation, Campaign Timeline, Assumptions & Risks";
}

export function isHomeDraftConfirmation(prompt: string): boolean {
  return /\b(proceed|create it|use this brief|ready to create|go ahead|do it|yes create|make it)\b/i.test(prompt.trim());
}

export function shouldCreateHomeWorkspace(prompt: string, mode: HomePromptMode): boolean {
  const normalized = prompt.toLowerCase();
  if (/\b(before|not yet|show me|explain|review|assumption|missing)\b/i.test(normalized)) return false;
  if (/\b(create|build|make)\b.*\b(workspace|campaign workspace|campaign plan|planning draft)\b/i.test(prompt)) return true;
  if (/\bcreate campaign\b/i.test(prompt)) return true;
  return mode === "create" && isHomeDraftConfirmation(normalized);
}

export function buildHomeRoleGuidanceReply(prompt: string): string | undefined {
  const text = prompt.trim().toLowerCase();
  if (/\b(content creator|copywriter|designer|content creation|create content|content expert)\b/.test(text)) {
    return [
      "For a content creator, the useful place to work is Content.",
      "You can start from the current draft assumptions while Campaign Planning continues to refine channels, success measures, budget, and timing.",
      "I recommend reviewing the paid media copy, landing page copy, email copy, and asset prompts first. If planning decisions change later, Panda will carry those updates into the content requirements.",
      "Open Content when you want to review or create copy and assets; open Content Planning if you need to inspect the requirements matrix first."
    ].join("\n\n");
  }
  if (/\b(campaign owner|campaign manager|owner)\b/.test(text)) {
    return [
      "As campaign owner, your best next workspace is Campaign Planning.",
      "You can review the starter brief, decide audience and market priority, shape channel strategy, set success measures, and confirm budget or timing assumptions.",
      "I can create a planning draft first, then you can refine it in Campaign Planning."
    ].join("\n\n");
  }
  if (/\b(rollout|ops|operation|publish|launch owner)\b/.test(text)) {
    return [
      "For rollout work, use Rollout once the plan and content direction are clear enough to prepare launch readiness.",
      "You can inspect connector needs, publish manifests, UTM checks, paid-media QA, and launch readiness status without triggering any live publish action."
    ].join("\n\n");
  }
  return undefined;
}

export function isHomeCampaignCreationIntent(prompt: string): boolean {
  return classifyHomeIntent(prompt).type === "create-campaign";
}

export function homeRouteAfterCampaignLaunch(prompt: string): AppView {
  return isHomeCampaignCreationIntent(prompt) ? "home" : "home";
}

export function restoreAppView(value: string | null): AppView {
  return navigationItems.some((item) => item.id === value) ? (value as AppView) : "home";
}

export function workspaceAgentMessageKey(campaignId: string, view: AppView) {
  return `${campaignId}:${view}`;
}

export function campaignConversationKey(campaignId: string) {
  return `${campaignId}:shared`;
}

export function visibleWorkspaceMessages(_shared: AgentMessage[], local: AgentMessage[]) {
  return compactAgentMessages(local);
}

export function compactAgentMessages<T extends { id: string; role: string; text: string }>(messages: T[]) {
  const byKey = new Map<string, T>();
  for (const message of messages) {
    byKey.set(`${message.role}:${normalizeMessageText(message.text)}`, message);
  }
  return Array.from(byKey.values());
}

function normalizeMessageText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function extractProductMention(prompt: string) {
  const match = prompt.match(/\b(TE\d{2}(?:-\d{2})?|TE\s?\d{2}(?:\s?AVR)?|SIW\s?6AT-A22|[A-Z]{2,5}\d{1,3}(?:-\d{1,3})?)\b/i);
  return match?.[1]?.replace(/\s+/g, " ").toUpperCase();
}

function extractCampaignSubject(prompt: string) {
  const match = prompt.match(/\bcampaign\s+(?:for|about|around|of)\s+([^,.:\n]+)/i) || prompt.match(/\bfor\s+([^,.:\n]+?)(?:,\s*the products|\s+campaign|\s+that|\s+it should|$)/i);
  return cleanCampaignSubject(match?.[1]);
}

function extractSourceUrls(prompt: string) {
  return Array.from(prompt.matchAll(/https?:\/\/[^\s,]+/gi)).map((match) => match[0].replace(/[).]+$/, ""));
}

function stripUrls(value: string) {
  return value.replace(/https?:\/\/\S+/gi, " ");
}

function inferHomeBriefChannels(prompt: string) {
  const text = prompt.toLowerCase();
  const channels = [
    text.includes("email") ? "Email" : undefined,
    text.includes("paid") || text.includes("linkedin") || text.includes("google") || text.includes("meta") ? "Paid Media" : undefined,
    text.includes("social") || text.includes("sprinklr") ? "Organic/HN" : undefined,
    text.includes("contentful") || text.includes("landing") || text.includes("website") || text.includes("promo") ? "HOL Landing Page" : undefined
  ].filter(Boolean);
  return channels.length ? channels.join(", ") : "Paid Media, Email, HOL Landing Page, Organic/HN, and localized campaign assets";
}

function cleanCampaignSubject(subject?: string) {
  const cleaned = subject
    ?.replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(the products? you can check here|products? you can check here)\b/gi, "")
    .replace(/\bit should\b[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/[,.:\-]+$/g, "")
    .trim();
  return cleaned || undefined;
}

function routeIntent(text: string): AppView | undefined {
  if (/\b(open|go to|show|route to)\b/.test(text)) {
    if (text.includes("campaign planning") || text.includes("h1")) return "campaign-planning";
    if (text.includes("content planning") || text.includes("cp1") || text.includes("cp4")) return "content-planning";
    if (text.includes("content")) return "content";
    if (text.includes("rollout") || text.includes("publish")) return "rollout";
    if (text.includes("optimize") || text.includes("performance")) return "optimize";
    if (text.includes("progress") || text.includes("status")) return "progress";
    if (text.includes("skills")) return "skills";
  }
  return undefined;
}

export function buildAgentScope(view: AppView, selectedObjectId?: string): PandaAgentScope {
  if (view === "content") {
    return {
      id: "content-specialist",
      role: "content-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["revise_copy", "check_compliance", "attach_evidence", "prepare_h2", "route_workspace"]
    };
  }
  if (view === "content-planning") {
    return {
      id: "content-planning-specialist",
      role: "content-planning-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["build_requirements", "check_figma_mapping", "find_locale_gaps", "prepare_h2"]
    };
  }
  if (view === "campaign-planning") {
    return {
      id: "campaign-planning-specialist",
      role: "campaign-planning-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["draft_objective", "find_h1_gaps", "build_h1_packet", "route_workspace"]
    };
  }
  if (view === "rollout") {
    return {
      id: "rollout-specialist",
      role: "rollout-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["check_connectors", "prepare_h3", "build_publish_manifest", "verify_no_auto_publish"]
    };
  }
  if (view === "optimize") {
    return {
      id: "optimize-specialist",
      role: "optimize-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["analyze_performance", "recommend_optimization", "prepare_h4", "promote_learning_candidate"]
    };
  }
  return {
    id: "home-orchestrator",
    role: "orchestrator",
    surface: view,
    selected_object_id: selectedObjectId,
    allowed_actions: ["ask_brief_question", "create_campaign_when_ready", "route_to_workspace", "explain_status"]
  };
}

export function buildPandaContextPacket({
  run,
  currentView,
  currentPhase,
  userRole,
  campaignPlan,
  planningObjects,
  contentRequirements,
  contentObjects,
  rolloutObjects
}: {
  run: CampaignRun;
  currentView: AppView;
  currentPhase: PhaseId;
  userRole: UserRole;
  campaignPlan: CampaignPlan;
  planningObjects: PlanningWorkObject[];
  contentRequirements: ContentRequirement[];
  contentObjects: ContentWorkObject[];
  rolloutObjects: RolloutWorkObject[];
}): PandaContextPacket {
  return {
    prototype: "panda-v4",
    campaign_id: run.campaignId,
    campaign_name: run.name,
    brief: run.brief,
    summary: run.summary,
    current_view: currentView,
    phase: currentPhase,
    current_gate: currentPhaseMeta(currentPhase).gate,
    user_role: userRole,
    approved_gates: run.gateDecisions.filter((decision) => decision.decision === "approved").map((decision) => decision.gateId),
    campaign_plan: campaignPlan,
    planning_objects: planningObjects.map((item) => ({
      id: item.id,
      title: item.title,
      lane: item.lane,
      owner: item.owner,
      status: item.status,
      gate: item.gate
    })),
    content_requirements: contentRequirements.map((item) => ({
      id: item.id,
      title: item.title,
      channel: item.channel,
      assetType: item.assetType,
      locale: item.locale,
      owner: item.owner,
      rolloutTarget: item.rolloutTarget
    })),
    content_objects: contentObjects.map((item) => ({
      id: item.id,
      title: item.title,
      channel: item.channel,
      owner: item.owner,
      status: item.status,
      gate: item.gate
    })),
    rollout_objects: rolloutObjects.map((item) => ({
      id: item.id,
      title: item.title,
      lane: item.lane,
      owner: item.owner,
      status: item.status,
      gate: item.gate
    })),
    artifacts: run.artifacts.map((artifact) => ({
      name: artifact.name,
      type: artifact.type,
      phase: artifact.phase,
      gate: artifact.gate
    })),
    gate_decisions: run.gateDecisions,
    worklog: run.worklog.map((entry) => ({
      agent: entry.agent,
      status: entry.status,
      message: entry.message,
      phase: entry.phase,
      createdAt: entry.createdAt
    }))
  };
}

export function draftWorkspaceAgentAnswer(view: AppView, question: string, context: PandaContextPacket) {
  const gate = context.current_gate;
  const trimmedQuestion = question.trim();
  if (view === "campaign-planning") {
    return `Campaign Planning Panda: I am using the shared campaign context for ${context.campaign_name}. I will check objective, audience, channels, KPIs, budget, risks, and missing inputs for your question: "${trimmedQuestion}". DeepSeek is refining this answer in the background.`;
  }
  if (view === "content-planning") {
    return `Content Planning Panda: I see ${context.content_requirements.length} requirements from the campaign plan for ${gate}. I will check channel, locale, Figma mapping, compliance, and rollout target coverage for your question: "${trimmedQuestion}". DeepSeek is refining this answer in the background.`;
  }
  if (view === "content") {
    const blocked = context.content_objects.filter((item) => item.status === "blocked").length;
    const revision = context.content_objects.filter((item) => item.status === "revision-requested").length;
    return `Content Panda: I see ${context.content_objects.length} content objects for ${gate}, with ${blocked} blocked and ${revision} needing revision. I will answer from the selected content and shared campaign context. DeepSeek is refining this answer in the background.`;
  }
  if (view === "rollout") {
    return `Rollout Panda: I see ${context.rollout_objects.length} rollout lanes for ${gate}. I will check connectors, QA evidence, publish-held status, and no-auto-publish constraints. DeepSeek is refining this answer in the background.`;
  }
  if (view === "optimize") {
    return `Optimize Panda: I will use the campaign worklog, gate decisions, and available performance evidence for ${gate}. DeepSeek is refining this answer in the background.`;
  }
  return `Panda: I am using the shared campaign context for ${context.campaign_name}. DeepSeek is refining this answer in the background.`;
}

export function draftSpecialistAgentResponse(view: AppView, question: string, context: PandaContextPacket): SpecialistAgentResponse {
  if (view === "campaign-planning") {
    const deliverablePatch = campaignPlanningDeliverablePatchFromInstruction(context.campaign_plan, context.planning_objects, question);
    if (deliverablePatch) {
      const deliverable = campaignPlanningDeliverables(context.campaign_plan).find((item) => item.id === deliverablePatch.id);
      const title = deliverablePatch.id === "marcom-plan" ? "Campaign plan" : deliverable?.title ?? "campaign artifact";
      return {
        answer: `Campaign Planning Panda created ${title} for ${context.campaign_name}. I updated the artifact with the latest objective, audience, KPIs, budget, timeline, and channel handoff content. No approval was taken yet.`,
        updates: [deliverablePatch],
        suggested_actions: ["Open artifact", "Ask Panda to revise the plan", "Prepare approval when objects are ready"],
        route: "campaign-planning"
      };
    }
    const updates = planningUpdatesFromInstruction(context.planning_objects, question);
    const changedTitles = updates.map((update) => context.planning_objects.find((item) => item.id === update.id)?.title || update.id);
    return {
      answer: changedTitles.length
        ? `Campaign Planning Panda updated the plan draft for ${context.campaign_name}: ${changedTitles.join(", ")}. No approval was taken; this is a planning revision for review.`
        : `Campaign Planning Panda is staying in plan editing mode for ${context.campaign_name}. I can revise objective, audience, KPIs, budget, channels, risks, and missing inputs without approving the plan.`,
      updates,
      suggested_actions: ["Review plan changes", "Ask Panda to revise another planning object", "Prepare approval when ready"],
      route: "campaign-planning"
    };
  }
  if (view === "content-planning") {
    const deliverablePatch = contentPlanningDeliverablePatchFromInstruction(context.campaign_plan, question);
    if (deliverablePatch) {
      return {
        answer: `Content Planning Panda created the creative concept for ${context.campaign_name}. I updated the concept artifact with the big idea, key message, visual direction, channel adaptation, and approval ask. No H2 approval was taken yet.`,
        updates: [deliverablePatch],
        suggested_actions: ["Review the creative concept", "Ask Panda to revise the concept", "Approve the object when ready"],
        route: "content-planning"
      };
    }
    const updatedRequirements = applyContentPlanningInstruction(context.content_requirements as ContentRequirement[], context.campaign_plan, question);
    const changed = updatedRequirements !== context.content_requirements;
    return {
      answer: changed
        ? "Content Planning Panda updated the content-planning requirements and kept the change scoped to Content Planning. Downstream Content objects should refresh from the revised matrix."
        : draftWorkspaceAgentAnswer(view, question, context),
      updates: changed ? [{ target: "content_requirements", action: "replace", requirements: updatedRequirements }] : [],
      suggested_actions: ["Review the content-planning package", "Open Requirements Matrix", "Prepare H2 after object approvals"],
      route: "content-planning"
    };
  }
  return {
    answer: draftWorkspaceAgentAnswer(view, question, context),
    updates: [],
    suggested_actions: ["Review workspace status", "Ask Panda for the next scoped action"],
    route: view
  };
}

const ALLOWED_SERVER_UPDATE_ACTIONS: Set<string> = new Set([
  "update_campaign_plan",
  "update_planning_object",
  "update_content_requirements",
  "update_content_object",
  "update_rollout_lane",
]);

const ALLOWED_SERVER_UPDATE_STATUSES: Set<string> = new Set([
  "draft",
  "in-review",
  "approved",
  "revision-requested",
  "blocked",
]);

export function normalizeServerUpdates(updates: unknown): ServerSpecialistUpdate[] {
  if (!Array.isArray(updates)) return [];
  return updates
    .filter(
      (update): update is Record<string, unknown> =>
        update !== null &&
        typeof update === "object" &&
        typeof (update as Record<string, unknown>).action === "string" &&
        ALLOWED_SERVER_UPDATE_ACTIONS.has((update as Record<string, unknown>).action as string) &&
        typeof (update as Record<string, unknown>).note === "string" &&
        ((update as Record<string, unknown>).note as string).trim().length > 0,
    )
    .slice(0, 8)
    .map((update) => ({
      action: update.action as ServerSpecialistUpdateAction,
      note: (update.note as string).trim().slice(0, 500),
      targetId: typeof update.targetId === "string" ? (update.targetId as string).trim().slice(0, 128) : undefined,
      status:
        typeof update.status === "string" && ALLOWED_SERVER_UPDATE_STATUSES.has(update.status)
          ? (update.status as WorkObjectStatus)
          : undefined,
      payload:
        update.payload !== null && typeof update.payload === "object" && !Array.isArray(update.payload)
          ? (update.payload as Record<string, unknown>)
          : undefined,
    }));
}

export function agentStackItems() {
  return [
    { lane: "Reasoning", model: "DeepSeek", status: "active", note: "Live campaign operator" },
    { lane: "Content", model: "Gemini placeholder", status: "placeholder", note: "Future content generation lane" },
    { lane: "Creative", model: "Figma / image model placeholder", status: "placeholder", note: "Future visual asset lane" },
    { lane: "Compliance", model: "Rules engine placeholder", status: "placeholder", note: "Future claims and brand guardrail lane" }
  ] as const;
}

export function progressForCampaign(run: CampaignRun, role: UserRole = defaultUserRole): CampaignProgress {
  const approved = new Set(run.gateDecisions.filter((decision) => decision.decision === "approved").map((decision) => decision.gateId));
  const activePhase = currentPhaseMeta(run.phase);
  const launchReadiness = Math.min(95, Math.round((approved.size / 4) * 70 + run.artifacts.length * 4));
  const workflowStatus: ProgressWorkflowItem[] = [
    {
      id: "campaign-planning",
      label: "Campaign Planning",
      gate: "H1",
      status: approved.has("H1") ? "done" : run.phase === "planning" ? "active" : "waiting",
      owner: "Campaign Owner",
      nextTask: approved.has("H1") ? "Plan signed" : "Review objectives, audience, budget, and channel plan"
    },
    {
      id: "content-planning",
      label: "Content Planning",
      gate: "H2",
      status: approved.has("H1") ? (run.phase === "content" ? "active" : approved.has("H2") ? "done" : "waiting") : "not-started",
      owner: "Content / Creative",
      nextTask: "Confirm creative concept, Figma mapping, and cross-channel requirements"
    },
    {
      id: "content",
      label: "Content",
      gate: "H2",
      status: run.phase === "content" ? "active" : approved.has("H2") ? "done" : "waiting",
      owner: "Content / Creative",
      nextTask: "Approve content pieces by channel, locale, CTA, and claim risk"
    },
    {
      id: "rollout",
      label: "Rollout",
      gate: "H3",
      status: run.phase === "rollout" ? "active" : approved.has("H3") ? "done" : approved.has("H2") ? "waiting" : "blocked",
      owner: "Campaign Owner",
      nextTask: "Build Contentful, Sprinklr, SFMC, paid media, UTM, QA, and publish-readiness evidence"
    },
    {
      id: "optimize",
      label: "Optimize",
      gate: "H4",
      status: run.phase === "optimize" ? "active" : approved.has("H4") ? "done" : approved.has("H3") ? "waiting" : "not-started",
      owner: "Campaign Owner",
      nextTask: "Review H4 performance recommendations and knowledge promotion candidates"
    }
  ];

  return {
    campaignId: run.campaignId,
    role,
    launchReadiness,
    currentPhase: activePhase.label,
    nextGate: activePhase.gate,
    workflowStatus,
    myTasks: [
      `Supervise ${run.name}`,
      `Review ${activePhase.gate} readiness`,
      "Resolve blocked owner inputs before launch"
    ],
    teamTasks: [
      { owner: "Paid Media", task: "Check paid-media plan, build objects, and QA matrix", status: "active" },
      { owner: "Content / Creative", task: "Review channel copy, Figma mapping, and claims", status: "active" },
      { owner: "HOL", task: "Confirm landing page and banner readiness", status: "queued" },
      { owner: "Email TA", task: "Prepare SFMC email and journey evidence", status: "queued" }
    ],
    blockers: approved.has("H2") ? ["H3 rollout evidence not signed yet"] : ["Content object approvals are not complete"],
    pandaTasks: [
      `Prepare ${activePhase.gate} roll-up summary`,
      "Watch object-level approvals and evidence gaps"
    ]
  };
}

export function progressTaskDetailRoute(task: string, owner?: UserRole): AppView {
  const text = `${owner ?? ""} ${task}`.toLowerCase();
  if (/\b(h4|optimize|performance|learning|knowledge promotion)\b/.test(text)) return "optimize";
  if (/\b(h3|rollout|publish|contentful|sprinklr|sfmc|utm|journey|email evidence|paid-media qa)\b/.test(text)) return "rollout";
  if (/\b(figma|requirements|creative concept|storyboard|content planning|cross-channel)\b/.test(text)) return "content-planning";
  if (/\b(copy|claims|claim|content pieces|content object|channel copy)\b/.test(text)) return "content";
  if (/\b(h1|campaign planning|plan|objective|audience|budget|kpi|strategy|brief|missing input)\b/.test(text)) return "campaign-planning";
  return "progress";
}

export function skillCapabilityItems(): SkillCapability[] {
  return [
    {
      id: "brand-playbook",
      name: "Brand Playbook",
      category: "knowledge",
      status: "active",
      usedBy: ["Content Planning", "Content", "Rollout"],
      description: "Mock uploaded Hilti tone, design, claims, and visual standards."
    },
    {
      id: "audience-personas",
      name: "Audience / Persona Files",
      category: "knowledge",
      status: "mock",
      usedBy: ["Campaign Planning", "Content Planning", "Content"],
      description: "Mock contractor, specifier, and regional audience context."
    },
    {
      id: "product-docs",
      name: "Product Docs",
      category: "knowledge",
      status: "mock",
      usedBy: ["Campaign Planning", "Content", "Rollout"],
      description: "Mock SIW 6AT-A22 product claims, technical specs, and offer details."
    },
    {
      id: "compliance-rules",
      name: "Compliance Rules",
      category: "knowledge",
      status: "needs setup",
      usedBy: ["Content", "Rollout"],
      description: "Mock legal, claims, and review-policy skill for risky copy."
    },
    {
      id: "campaign-examples",
      name: "Campaign Examples",
      category: "knowledge",
      status: "mock",
      usedBy: ["Home", "Campaign Planning", "Content Planning"],
      description: "Prior-campaign examples Panda can reuse as skill memory."
    },
    {
      id: "figma",
      name: "Figma",
      category: "integration",
      status: "mock",
      usedBy: ["Content Planning", "Content", "Rollout"],
      description: "Mock creative board, layout, and approval integration."
    },
    {
      id: "contentful",
      name: "Contentful",
      category: "integration",
      status: "mock",
      usedBy: ["Rollout"],
      description: "Mock HOL landing page and banner build integration."
    },
    {
      id: "sprinklr",
      name: "Sprinklr",
      category: "integration",
      status: "needs setup",
      usedBy: ["Rollout"],
      description: "Mock organic social and HN draft-post integration."
    },
    {
      id: "sfmc",
      name: "SFMC / Marketing Cloud",
      category: "integration",
      status: "needs setup",
      usedBy: ["Content", "Rollout"],
      description: "Mock email content, build, translation, and journey integration."
    },
    {
      id: "analytics",
      name: "GA4 / Power BI",
      category: "integration",
      status: "mock",
      usedBy: ["Optimize"],
      description: "Mock read-only performance data for H4 optimization."
    },
    {
      id: "astra",
      name: "Teams / Astra Gates",
      category: "integration",
      status: "mock",
      usedBy: ["Campaign Planning", "Content Planning", "Content", "Rollout", "Optimize"],
      description: "Mock gate approval and reviewer task integration."
    }
  ];
}

export function campaignPlanForRun(run: CampaignRun): CampaignPlan {
  if (run.snapshot?.plan) return run.snapshot.plan;
  const agentPlan = campaignPlanFromArtifact(run);
  if (agentPlan) return agentPlan;

  const briefPlan = campaignPlanFromBrief(run);
  return {
    campaignId: run.campaignId,
    name: run.name,
    heroProduct: briefPlan.heroProduct,
    markets: briefPlan.markets,
    locales: briefPlan.locales,
    audience: briefPlan.audience,
    budget: briefPlan.budget,
    timeline: "Q4 launch window; no auto-publish before H3 approval.",
    channels: briefPlan.channels,
    kpis: [
      "Qualified HOL visits",
      "Paid-media CTR and CPC within benchmark",
      "Email engagement by locale",
      "H3 publish readiness without auto-publish"
    ],
    assumptions: [
      "Product docs and brand playbook are active Panda skills.",
      "Figma, Contentful, Sprinklr, SFMC, and paid media connectors are mocked in prototype.",
      "Legal/compliance review is required for performance claims before H2."
    ]
  };
}

export function campaignPlanningObjectsFromPlan(plan: CampaignPlan): PlanningWorkObject[] {
  const channelPlan = plan.channels
    .map((channel) => `${channel.name}: ${channel.objective} (${channel.requiredAssets.join(", ")})`)
    .join("; ");
  return [
    planningObject(
      "campaign-objective",
      "Campaign Objective",
      "Strategy",
      "Campaign Owner",
      "in-review",
      `Launch ${plan.name} around ${plan.heroProduct} for ${plan.markets.join(", ")}.`,
      ["Brief intake", "Campaign plan"]
    ),
    planningObject(
      "target-audience",
      "Target Audience",
      "Audience",
      "Campaign Owner",
      "in-review",
      `${plan.audience.join(", ")} across ${plan.markets.join(", ")}.`,
      ["Audience skill", "Market scope"]
    ),
    planningObject(
      "kpi-definition",
      "KPI Definition",
      "Analytics",
      "Leadership / Approver",
      "in-review",
      plan.kpis.join("; "),
      ["KPI benchmark", "Gate criteria"]
    ),
    planningObject(
      "channel-strategy",
      "Channel Strategy",
      "Media",
      "Paid Media",
      "draft",
      channelPlan,
      ["Paid media advisor", "Channel plan"]
    ),
    planningObject(
      "budget-allocation",
      "Budget Allocation",
      "Finance",
      "Campaign Owner",
      "draft",
      `${plan.budget} allocated across ${plan.channels.map((channel) => channel.name).join(", ")}.`,
      ["Budget brief", "Media plan"]
    ),
    planningObject(
      "campaign-timeline",
      "Campaign Timeline",
      "PMO",
      "Campaign Owner",
      "draft",
      `${plan.timeline} Locales: ${plan.locales.join(", ")}.`,
      ["Launch window", "Locale matrix"]
    ),
    planningObject(
      "assumptions-risks",
      "Assumptions & Risks",
      "Risk",
      "Legal / Compliance",
      "draft",
      plan.assumptions.join("; "),
      ["Risk register", "Compliance assumptions"]
    ),
    planningObject(
      "missing-inputs",
      "Missing Inputs",
      "Risk",
      "Campaign Owner",
      "blocked",
      "Confirm exact offer, final benchmark ranges, live connector credentials, and regional approver names before H1 approval.",
      ["Panda gap scan", "RMB output checklist"]
    )
  ];
}

export function campaignPlanningDeliverables(plan: CampaignPlan): RmbDeliverable[] {
  const channelNames = plan.channels.map((channel) => channel.name).join(", ");
  const paidMedia = plan.channels.find((channel) => channel.name === "Paid Media");
  const email = plan.channels.find((channel) => channel.name === "Email");
  const hol = plan.channels.find((channel) => channel.name === "HOL Landing Page");
  const organic = plan.channels.find((channel) => channel.name === "Organic / HN");

  return withRmbDeliverableDefaults([
    {
      id: "marcom-plan",
      title: "MarCom Planning Packet",
      workspace: "Campaign Planning",
      gate: "H1",
      owner: "Campaign Owner",
      requestedBy: "Campaign Planning Owner: Erin Shier",
      outputFormats: ["PPTX"],
      sections: ["Campaign theme", "Objective and KPIs", "Hero product", "Offer", "Audience", "Timeline", "Channel overview"],
      summary: `${campaignThemeForPlan(plan)} MarCom planning packet with ${plan.audience.join(" / ")} audience, ${plan.budget} budget, and ${plan.channels.length} channels.`,
      previewItems: [
        campaignThemeForPlan(plan),
        `Audience: ${plan.audience.join(" / ")}`,
        `Channels: ${channelNames}`
      ],
      sourceInputs: ["Campaign objectives", "Hero products"],
      handoffTarget: "Content Planning",
      approvalLevel: "gate",
      status: "in-review",
      artifactDetails: [
        { label: "Campaign theme", value: campaignThemeForPlan(plan) },
        { label: "Objective and KPIs", value: `Objective: create qualified demand and measurable downstream action. KPIs: ${plan.kpis.join(", ")}.` },
        { label: "Hero product", value: plan.heroProduct },
        { label: "Offer", value: "Offer or promotion mechanic requires Campaign Owner confirmation before leadership review." },
        { label: "Audience", value: plan.audience.join(" / ") },
        { label: "Timeline", value: plan.timeline },
        { label: "Channel overview", value: plan.channels.map((channel) => `${channel.name} -> ${channel.rolloutTarget}`).join("; ") }
      ],
      discussionNotes: [
        `Panda assembled the MarCom planning packet from the active ${plan.name} campaign context.`,
        "This artifact is the source of handoff for Content Planning and should capture leadership revisions before final planning review."
      ],
      workspaceAction: "Review the MarCom planning packet, ask Panda for revisions, then prepare final planning signoff"
    },
    {
      id: "paid-media-plan",
      title: "Paid Media Strategy / Media Plan",
      workspace: "Campaign Planning",
      gate: "H1",
      owner: "Paid Media",
      requestedBy: "RMB paid media strategy team",
      outputFormats: ["Excel", "PPTX"],
      sections: ["Platform mix", "Campaign/ad structure", "Audiences", "Keywords", "Budget split", "Projected KPIs", "Asset strategy", "Testing roadmap"],
      summary: paidMedia
        ? `Paid media plan for ${plan.heroProduct}: ${paidMedia.requiredAssets.length} asset types, budget split, KPI benchmarks, audience logic, and testing roadmap.`
        : "Paid media is not selected in the active campaign plan.",
      previewItems: [
        paidMedia ? `${paidMedia.requiredAssets.length} paid-media asset types scoped` : "Paid-media channel not selected",
        `${plan.budget} to split by platform, campaign, and ad type`,
        "Benchmarks: CTR, ROAS, conversion rate, CPM"
      ],
      sourceInputs: ["MarCom plan", "CRM/LAL/GA4 audience data", "Power BI benchmarks", "Paid Media Advisor"],
      handoffTarget: "Content Planning",
      approvalLevel: "object-and-final",
      status: paidMedia ? "draft" : "blocked",
      artifactDetails: [
        { label: "Platform mix", value: paidMedia ? "LinkedIn, Meta, Google Search, and retargeting are candidate lanes for validation." : "Paid media channel not selected." },
        { label: "Campaign/ad structure", value: paidMedia ? paidMedia.requiredAssets.join(", ") : "No paid media assets scoped." },
        { label: "Audiences", value: plan.audience.join(" / ") },
        { label: "Budget split", value: `${plan.budget}; split by channel, funnel stage, and market after benchmarks are confirmed.` },
        { label: "Projected KPIs", value: plan.kpis.join(", ") },
        { label: "Testing roadmap", value: "Test proof-point angle, CTA, market variant, and audience segment before scaling." }
      ]
    },
    {
      id: "hol-journey-map",
      title: "HOL Customer Journey Map",
      workspace: "Campaign Planning",
      gate: "H1",
      owner: "HOL",
      requestedBy: "RMB HOL team",
      outputFormats: ["Excel", "PPTX"],
      sections: ["Entry paths", "Touchpoints", "Landing pages", "Banners", "Required UX assets", "Direct-entry journey"],
      summary: hol
        ? `HOL journey map for ${plan.heroProduct}: channel entry paths, Contentful landing page needs, banner touchpoints, and direct-entry journey.`
        : "HOL landing page is not selected in the active campaign plan.",
      previewItems: [
        hol ? `${hol.requiredAssets.join(", ")} planned for Contentful` : "HOL landing page not selected",
        "Map campaign-channel entry and direct website entry",
        "Identify LP/banner assets needed for optimal UX"
      ],
      sourceInputs: ["MarCom plan", "HOL website map", "HOL UX advisor"],
      handoffTarget: "Content Planning",
      approvalLevel: "object-and-final",
      status: hol ? "draft" : "blocked",
      artifactDetails: [
        { label: "Entry paths", value: "Paid media, organic/HN, email, and direct web entry should resolve into one coherent journey." },
        { label: "Landing pages", value: hol ? hol.requiredAssets.join(", ") : "No HOL landing page assets scoped." },
        { label: "Required UX assets", value: "Hero module, proof section, CTA module, banner placements, and market/localized copy slots." },
        { label: "Contentful handoff", value: "Content Planning must carry page module requirements and evidence into Contentful build." }
      ]
    },
    {
      id: "email-ta-brief",
      title: "Email Strategy & TA Brief",
      workspace: "Campaign Planning",
      gate: "H1",
      owner: "Email TA",
      requestedBy: "RMB email strategy team",
      outputFormats: ["PPTX", "Excel"],
      sections: ["Segments", "Email count", "Sequence", "Journey role", "Messaging strategy", "Testing plan"],
      summary: email
        ? `Email TA brief for ${plan.heroProduct}: segments, journey role, email modules, message sequence, and SFMC assumptions.`
        : "Email is not selected in the active campaign plan.",
      previewItems: [
        email ? `${email.requiredAssets.length} email modules scoped` : "Email channel not selected",
        "Define Awareness / Consideration / Conversion role per email",
        "Prepare SFMC audience and testing assumptions"
      ],
      sourceInputs: ["MarCom plan", "Email templates", "SFMC audience data", "Email advisor"],
      handoffTarget: "Content Planning",
      approvalLevel: "object-and-final",
      status: email ? "draft" : "blocked",
      artifactDetails: [
        { label: "Segments", value: plan.audience.join(" / ") },
        { label: "Email count", value: email ? `${email.requiredAssets.length} modules or emails scoped from the campaign plan.` : "No email assets scoped." },
        { label: "Sequence", value: "Awareness proof, consideration detail, and conversion CTA sequence to be confirmed with Email TA." },
        { label: "Testing plan", value: "Subject line, CTA, proof point, and audience segment tests are proposed before rollout." }
      ]
    },
    {
      id: "organic-hn-strategy",
      title: "Organic Social & Hilti Network Strategy",
      workspace: "Campaign Planning",
      gate: "H1",
      owner: "Content / Creative",
      requestedBy: "RMB organic/HN team",
      outputFormats: ["PPTX", "Excel"],
      sections: ["Campaign story", "Owned social", "Hilti Network", "Asset list", "Formats", "Dimensions"],
      summary: organic
        ? `Organic/HN strategy for ${plan.heroProduct}: campaign story, owned social role, HN role, formats, and dimensions.`
        : "Organic/HN is not selected in the active campaign plan.",
      previewItems: [
        organic ? `${organic.requiredAssets.join(", ")} scoped for Sprinklr/HN` : "Organic/HN not selected",
        "Separate Hilti owned-channel and Hilti Network narrative needs",
        "Carry format and dimension requirements into content planning"
      ],
      sourceInputs: ["MarCom plan", "Organic/HN advisor", "Audience and product narrative"],
      handoffTarget: "Content Planning",
      approvalLevel: "object-and-final",
      status: organic ? "draft" : "blocked",
      artifactDetails: [
        { label: "Campaign story", value: `${plan.heroProduct} story adapted for owned social and Hilti Network without overclaiming performance.` },
        { label: "Owned social", value: organic ? "Sprinklr-ready post/message requirements are in scope." : "Owned social assets not scoped." },
        { label: "Hilti Network", value: "HN should carry peer/contractor story and local proof rather than paid-media copy lifted directly." },
        { label: "Formats and dimensions", value: organic ? organic.requiredAssets.join(", ") : "No formats scoped." }
      ]
    }
  ]);
}

function planningObjectValue(objects: Array<Pick<PlanningWorkObject, "id" | "copy">>, id: string, fallback: string) {
  return objects.find((item) => item.id === id)?.copy ?? fallback;
}

function campaignPlanningDeliverableIdFromInstruction(instruction: string): RmbDeliverable["id"] | undefined {
  const normalized = instruction.toLowerCase();
  if (/\bmarcom\b/.test(normalized) || /\bh1\b/.test(normalized) || normalized.includes("planning packet")) return "marcom-plan";
  if (normalized.includes("paid media") || normalized.includes("media plan")) return "paid-media-plan";
  if (normalized.includes("hol") || normalized.includes("journey")) return "hol-journey-map";
  if (normalized.includes("email") || normalized.includes("ta brief")) return "email-ta-brief";
  if (normalized.includes("organic") || normalized.includes("hilti network") || /\bhn\b/.test(normalized)) return "organic-hn-strategy";
  return undefined;
}

export function campaignPlanningDeliverablePatchFromInstruction(
  plan: CampaignPlan,
  objects: Array<Pick<PlanningWorkObject, "id" | "copy">>,
  instruction: string
): Extract<SpecialistAgentUpdate, { target: "rmb_deliverable" }> | undefined {
  const normalized = instruction.toLowerCase();
  const asksToCreate = /\b(create|build|draft|make|revise|update|prepare)\b/.test(normalized);
  const id = campaignPlanningDeliverableIdFromInstruction(instruction);
  if (!id || !asksToCreate) return undefined;

  const deliverable = campaignPlanningDeliverables(plan).find((item) => item.id === id);
  if (!deliverable) return undefined;

  const hero = plan.heroProduct;
  const objective = planningObjectValue(objects, "campaign-objective", `Create qualified demand for ${hero}.`);
  const audience = planningObjectValue(objects, "target-audience", plan.audience.join(" / "));
  const channel = planningObjectValue(objects, "channel-strategy", plan.channels.map((item) => item.name).join(", "));
  const kpis = planningObjectValue(objects, "kpi-definition", plan.kpis.join(", "));
  const budget = planningObjectValue(objects, "budget-allocation", plan.budget);
  const timeline = planningObjectValue(objects, "campaign-timeline", plan.timeline);

  const artifactDetails =
    id === "marcom-plan"
      ? [
          { label: "Campaign theme", value: campaignThemeForPlan(plan) },
          { label: "Objective and KPIs", value: `${objective} KPIs: ${kpis}` },
          { label: "Audience", value: audience },
          { label: "Offer", value: "Confirm offer/promotion mechanism with Campaign Owner before final planning review." },
          { label: "Budget and timeline", value: `${budget} ${timeline}` },
          { label: "Channel overview", value: channel }
        ]
      : deliverable.artifactDetails.map((detail) => {
          if (detail.label === "Projected KPIs") return { ...detail, value: kpis };
          if (detail.label === "Budget split") return { ...detail, value: budget };
          if (detail.label === "Audiences" || detail.label === "Segments") return { ...detail, value: audience };
          return detail;
        });

  const artifactName = id === "marcom-plan" ? "MarCom Planning Packet" : deliverable.title;
  const previewName = id === "marcom-plan" ? "MarCom plan" : artifactName;
  return {
    target: "rmb_deliverable",
    id,
      patch: {
      summary: `${artifactName} created from the active campaign plan, latest planning objects, and Panda/user discussion for ${hero}. Theme: ${campaignThemeForPlan(plan)}`,
      status: "in-review",
      previewItems: [
        campaignThemeForPlan(plan),
        `${plan.markets.join(", ")} · ${plan.audience.join(" / ")}`,
        `Handoff: ${deliverable.handoffTarget}`
      ],
      artifactDetails,
      discussionNotes: [
        `Panda created ${artifactName} from the active ${plan.name} plan and latest Campaign Planning conversation.`,
        "This artifact can now be revised by asking Campaign Planning Panda for specific objective, audience, KPI, channel, budget, or timeline changes."
      ],
      workspaceAction: `Review ${artifactName}, revise with Campaign Planning Panda, then include it in the final planning packet`
    }
  };
}

export function campaignPlanningReadiness(objects: PlanningWorkObject[]): PlanningReadiness {
  const approved = objects.filter((item) => item.status === "approved").length;
  const blocked = objects.filter((item) => item.status === "blocked").length;
  const revision = objects.filter((item) => item.status === "revision-requested").length;
  const total = objects.length;
  return {
    approved,
    total,
    blocked,
    revision,
    pct: total ? Math.round((approved / total) * 100) : 0
  };
}

export function gateApprovalReadiness({
  phase,
  planningObjects,
  contentObjects,
  rolloutObjects,
}: {
  phase: PhaseId;
  planningObjects: PlanningWorkObject[];
  contentObjects: ContentWorkObject[];
  rolloutObjects: RolloutWorkObject[];
}): GateApprovalReadiness {
  if (phase === "planning") {
    const readiness = campaignPlanningReadiness(planningObjects);
    return buildGateApprovalReadiness(
      readiness.approved === readiness.total && readiness.total > 0 && readiness.blocked === 0 && readiness.revision === 0,
      readiness.approved,
      readiness.total,
      "Approve every H1 planning object before signing the gate.",
    );
  }

  if (phase === "content") {
    const readiness = contentWorkspaceReadiness(contentObjects);
    return buildGateApprovalReadiness(
      readiness.approved === readiness.total && readiness.total > 0 && readiness.blocked === 0 && readiness.revision === 0,
      readiness.approved,
      readiness.total,
      "Approve every active content object before signing H2.",
    );
  }

  if (phase === "rollout") {
    const readiness = rolloutWorkspaceReadiness(rolloutObjects);
    return buildGateApprovalReadiness(
      readiness.approved === readiness.total && readiness.total > 0 && readiness.blocked === 0 && readiness.revision === 0,
      readiness.approved,
      readiness.total,
      "Approve every active rollout lane before signing H3.",
    );
  }

  return {
    ready: true,
    reason: "H4 review has no object-level approval blockers in this prototype.",
    approved: 0,
    total: 0,
  };
}

export function applyPlanningInstruction(objects: PlanningWorkObject[], instruction: string): PlanningWorkObject[] {
  const updates = planningUpdatesFromInstruction(objects, instruction);
  if (!updates.length) return objects;
  const byId = new Map(updates.map((update) => [update.id, update.patch]));
  return objects.map((item) => {
    const patch = byId.get(item.id);
    if (!patch) return item;
    return {
      ...item,
      ...patch,
      evidence: patch.evidence ?? item.evidence
    };
  });
}

function planningUpdatesFromInstruction(objects: Array<Pick<PlanningWorkObject, "id" | "title" | "copy">>, instruction: string): Extract<SpecialistAgentUpdate, { target: "planning_object" }>[] {
  const text = instruction.trim();
  const normalized = text.toLowerCase();
  const productMatch = text.match(/\b(?:focus on|for|about|to)\s+([A-Z]{1,5}\d{1,3}(?:-\d{1,3})?|TE\d{2}(?:-\d{2})?|SIW\s*6AT-A22)\b/i);
  const product = productMatch?.[1]?.toUpperCase().replace(/\s+/g, " ");
  const mentionsMocn = /\bmocn\b/i.test(text);
  const wantsUpdate = /\b(update|change|revise|adjust|edit|focus|complete|completed|should be completed)\b/i.test(text);
  const objectiveMatch = text.match(/campaign objective\s*:\s*([^.;\n]+)/i);
  const kpiMatch = text.match(/\bkpi\s*:\s*([^.;\n]+)/i);
  const mentionsChannelStrategy = /\bchannel\s+st(?:r)?ategy\b|\bchannel strategy\b/i.test(text);
  const draftsRemainingH1 = /\bdraft\b/.test(normalized) && /\b(remaining|rest)\b/.test(normalized) && /\bh1\b/.test(normalized);
  if (!wantsUpdate && !product && !mentionsMocn && !objectiveMatch && !kpiMatch && !mentionsChannelStrategy && !draftsRemainingH1) return [];

  const updates: Extract<SpecialistAgentUpdate, { target: "planning_object" }>[] = [];

  if (draftsRemainingH1) {
    const draftPatches: Record<string, { status: WorkObjectStatus; copy: string; evidence: string[] }> = {
      "channel-strategy": {
        status: "in-review",
        copy: "Draft H1 channel strategy: use Paid Media, Email, HOL Landing Page, Organic/HN, and Banner as coordinated workstreams. Paid Media creates demand, Email and HOL convert, Organic/HN supports credibility, and Banner reinforces the landing journey.",
        evidence: ["Home Panda continuation", "Campaign Planning Panda H1 draft"]
      },
      "budget-allocation": {
        status: "in-review",
        copy: "Draft H1 budget allocation: keep the current campaign budget as the envelope, prioritize paid media and landing-page conversion paths first, reserve test budget for CTA/proof-point variants, and confirm final split with Campaign Owner and Paid Media before H1 approval.",
        evidence: ["Home Panda continuation", "Budget allocation draft"]
      },
      "campaign-timeline": {
        status: "in-review",
        copy: "Draft H1 timeline: complete the planning review, hand content planning requirements into Content Planning, complete H2 content/QA approvals, prepare rollout manifests and connector QA for H3, then move to H4 insight review after live performance evidence is available.",
        evidence: ["Home Panda continuation", "Campaign timeline draft"]
      },
      "assumptions-risks": {
        status: "in-review",
        copy: "Draft H1 assumptions and risks: legal claim evidence, market/localization fit, final budget split, connector access, and approver availability must be confirmed before gate signoff or rollout readiness.",
        evidence: ["Home Panda continuation", "Risk register draft"]
      },
      "missing-inputs": {
        status: "in-review",
        copy: "Draft missing-inputs register with owners: Campaign Owner confirms offer, budget, timing, and decision owner; Paid Media confirms benchmarks and channel split; Legal / Compliance confirms claims evidence; Content / Creative confirms brand playbook and Figma inputs; Rollout owners confirm connector access.",
        evidence: ["Home Panda continuation", "Missing inputs assigned to owners"]
      }
    };
    for (const item of objects) {
      const patch = draftPatches[item.id];
      if (!patch) continue;
      updates.push({ target: "planning_object", id: item.id, patch });
    }
    return updates;
  }

  const objective = objects.find((item) => item.id === "campaign-objective");
  if (objective && (product || objectiveMatch || (wantsUpdate && normalized.includes("objective")))) {
    updates.push({
      target: "planning_object",
      id: objective.id,
      patch: {
        status: objectiveMatch ? "in-review" : "revision-requested",
        copy: objectiveMatch
          ? `Campaign objective: ${objectiveMatch[1].trim()}.`
          : product
          ? `Revised draft objective: focus the campaign planning around ${product}, then validate audience, channel fit, KPIs, budget, and risk assumptions before H1 approval.`
          : `${objective.copy} Revised per Campaign Owner instruction before H1 approval.`,
        evidence: ["Campaign Owner instruction", "H1 planning revision"]
      }
    });
  }

  const audience = objects.find((item) => item.id === "target-audience");
  if (audience && mentionsMocn) {
    updates.push({
      target: "planning_object",
      id: audience.id,
      patch: {
        status: "revision-requested",
        copy: "Revised draft audience: prioritize MOCN audience needs and keep downstream content planning scoped to this segment until leadership confirms broader audiences.",
        evidence: ["Campaign Owner instruction", "MOCN audience revision"]
      }
    });
  }

  const kpi = objects.find((item) => item.id === "kpi-definition");
  if (kpi && kpiMatch) {
    updates.push({
      target: "planning_object",
      id: kpi.id,
      patch: {
        status: "in-review",
        copy: `Primary KPI: ${kpiMatch[1].trim()}.`,
        evidence: ["Campaign Owner instruction", "KPI definition update"]
      }
    });
  }

  const channelStrategy = objects.find((item) => item.id === "channel-strategy");
  if (channelStrategy && mentionsChannelStrategy && /\bcomplete|completed|should be completed\b/i.test(text)) {
    updates.push({
      target: "planning_object",
      id: channelStrategy.id,
      patch: {
        status: "in-review",
        copy: `${channelStrategy.copy} Confirmed as an H1 campaign-planning deliverable before downstream content planning begins.`,
        evidence: ["Campaign Owner instruction", "H1 channel strategy completion"]
      }
    });
  }

  return updates;
}

export function contentRequirementsFromPlan(plan: CampaignPlan): ContentRequirement[] {
  const requirements = plan.channels.flatMap((channel) =>
    channel.requiredAssets.map((asset) =>
      requirement(
        plan,
        `${channel.id}-${slug(asset)}`,
        channel.name as ContentRequirement["channel"],
        asset,
        titleForAsset(plan.heroProduct, channel.name, asset),
        "master",
        channel.owner,
        channel.rolloutTarget
      )
    )
  );
  requirements.push(
    requirement(plan, "claim-01", "Claims", "Performance claim", `${titleCase(plan.heroProduct)} proof point`, "master", "Legal / Compliance", "Contentful")
  );
  for (const locale of plan.locales.filter((locale) => locale !== "de-DE").slice(-2)) {
    requirements.push(
      requirement(plan, `locale-${slug(locale)}`, "Email", "Locale variant", `${locale} email variant`, locale, "Content / Creative", "SFMC")
    );
  }
  return requirements;
}

export function applyContentPlanningInstruction(requirements: ContentRequirement[], plan: CampaignPlan, instruction: string): ContentRequirement[] {
  const normalized = instruction.toLowerCase();
  if (!normalized.includes("mocn")) return requirements;
  if (requirements.some((item) => item.id === "mocn-audience-content")) return requirements;

  const mocnRequirement = requirement(
    plan,
    "mocn-audience-content",
    "Paid Media",
    "MOCN audience content",
    `${titleCase(plan.heroProduct)} MOCN audience content`,
    "master",
    "Paid Media",
    "Paid Media"
  );

  return [
    ...requirements,
    { ...mocnRequirement, evidence: [...mocnRequirement.evidence, "Panda instruction: MOCN audience only"] }
  ];
}

export function contentPlanningDeliverablePatchFromInstruction(
  plan: CampaignPlan,
  instruction: string
): Extract<SpecialistAgentUpdate, { target: "rmb_deliverable" }> | undefined {
  const normalized = instruction.toLowerCase();
  const asksForCp1 = /\bcp1\b/.test(normalized) || normalized.includes("creative concept") || normalized.includes("creative concept");
  const asksToAct = /\b(create|build|draft|make|revise|update|refine|rework)\b/.test(normalized);
  if (!asksForCp1 || !asksToAct) return undefined;

  const hero = titleCase(plan.heroProduct);
  const primaryAudience = plan.audience[0] || "target buyers";
  const markets = plan.markets.join(", ");
  const bigIdea = campaignThemeHeadline(plan.heroProduct);
  return {
    target: "rmb_deliverable",
    id: "cp1-creative-concept",
    patch: {
      status: "in-review",
      previewItems: [
        `${bigIdea} for ${primaryAudience}`,
        `Campaign markets: ${markets}`,
        "Ready for creative review"
      ],
      artifactDetails: [
        {
          label: "Big idea",
          value: `${bigIdea} positions the campaign around jobsite confidence, fewer reworks, and a clear next step to HOL or sales contact.`
        },
        {
          label: "Key message",
          value: `${hero} helps ${primaryAudience} move faster on demanding jobs with proof-led Hilti reliability.`
        },
        {
          label: "Visual direction",
          value: "Use real jobsite texture, close product-in-use crops, Hilti red CTA panels, and one proof point per frame."
        },
        {
          label: "Channel adaptation",
          value: `Carry the idea into ${plan.channels.map((channel) => channel.name).join(", ")} with format-specific copy and compliance evidence.`
        },
        {
          label: "Approval ask",
          value: "Approve the creative direction or request revision before requirements and Figma mapping are finalized."
        }
      ],
      discussionNotes: [
        `Panda created the creative concept from the active ${plan.name} campaign plan, audience, channels, and content requirements.`,
        "This is a working creative concept artifact, not only a preview/download card."
      ],
      workspaceAction: "Review the creative concept, revise with Panda, then mark the object ready"
    }
  };
}

export function buildContentPlanningBridge(plan: CampaignPlan, requirements: ContentRequirement[]): ContentPlanningBridge {
  const channels = Array.from(new Set(requirements.map((item) => item.channel)));
  const hero = plan.heroProduct;
  return {
    creativeConcept: {
      storyId: "CP1",
      title: "Creative Concept",
      status: "in-review",
      head: campaignThemeHeadline(hero),
      heart: "Confident, direct, proof-led Hilti red system energy with real jobsite texture rather than generic product glamour.",
      hands: `Show ${hero} in use: fewer reworks, faster decisions, clear next step to HOL or sales contact.`,
      proofPoints: ["Jobsite reliability", "Clear ROI argument", "Human-gated claims and compliance"],
      visualDirections: ["Close-up product-in-use frame", "Before/after worksite proof", "Simple red CTA panel with one action"]
    },
    requirements: {
      storyId: "CP2",
      title: "Cross-Channel Requirements",
      status: "in-review",
      rows: requirements,
      channels,
      productionNotes: [
        "One row per required asset, locale, owner, rollout target, and compliance evidence.",
        "This matrix is the production scope baseline for Content Creation.",
        "Changes here should create or update downstream Content work objects."
      ]
    },
    storyboard: {
      storyId: "CP3",
      title: "Storyboard Package",
      status: "draft",
      frames: channels.slice(0, 6).map((channel, index) => ({
        id: `story-${slug(channel)}-${index + 1}`,
        scene: `${channel} opening moment`,
        direction: index % 2 === 0 ? "Lead with product proof and a tight jobsite crop." : "Lead with audience pain point and a clear Hilti answer.",
        channel,
        script: `${hero}: prove the value, show the action, close with one CTA.`
      })),
      shotlist: ["Hero product close-up", "In-situ application", "Outcome proof frame", "CTA/end card"],
      productionPlan: ["Confirm claims with Compliance", "Map visual idea to Figma placeholders", "Prepare static mockups for content review"]
    },
    figmaBoard: {
      storyId: "CP4",
      title: "Figma Board Mapping",
      status: "draft",
      mappingStatus: "ready-to-create",
      figmaUrl: "",
      frames: channels.map((channel) => ({
        id: `figma-${slug(channel)}`,
        name: `${channel} master placeholders`,
        channel,
        placeholderCount: requirements.filter((item) => item.channel === channel).length,
        ratio: channel === "Paid Media" ? "1:1 / 4:5 / 16:9" : channel === "Email" ? "Email module" : "Responsive module"
      })),
      actions: ["Create mapping board", "Open Figma", "Sync placeholders to Content"]
    }
  };
}

export function contentPlanningDeliverables(plan: CampaignPlan, requirements: ContentRequirement[]): RmbDeliverable[] {
  const bridge = buildContentPlanningBridge(plan, requirements);
  const channels = Array.from(new Set(requirements.map((item) => item.channel)));
  const locales = Array.from(new Set(requirements.map((item) => item.locale))).filter((locale) => locale !== "master");
  return withRmbDeliverableDefaults([
    {
      id: "cp1-creative-concept",
      title: "Creative Concept",
      workspace: "Content Planning",
      gate: "H2",
      owner: "Content / Creative",
      requestedBy: "RMB content development team",
      outputFormats: ["PPTX", "Figma mock"],
      sections: ["Creative concept", "Messaging brief", "Visual direction", "Proof points", "Objective-level approval"],
      previewItems: [
        `${campaignThemeHeadline(plan.heroProduct)} for ${plan.audience[0] || "target audience"}`,
        "Head / heart / hands narrative",
        "Proof-led visual directions ready for review"
      ],
      sourceInputs: ["Campaign plan", "Paid media strategy", "Organic/HN strategy", "Brand playbook"],
      handoffTarget: "Content",
      approvalLevel: "object-and-final",
      status: "in-review",
      artifactDetails: [
        { label: "Head", value: bridge.creativeConcept.head },
        { label: "Heart", value: bridge.creativeConcept.heart },
        { label: "Hands", value: bridge.creativeConcept.hands },
        { label: "Proof points", value: bridge.creativeConcept.proofPoints.join("; ") },
        { label: "Visual direction", value: bridge.creativeConcept.visualDirections.join("; ") }
      ],
      discussionNotes: [
        "Panda shaped this creative concept package from the active campaign plan, audience, channels, and brand evidence.",
        "Review should happen at object level before the final content handoff."
      ],
      workspaceAction: "Open the creative concept detail and revise the concept"
    },
    {
      id: "cp2-requirements-matrix",
      title: "Cross-Channel Requirements Matrix",
      workspace: "Content Planning",
      gate: "H2",
      owner: "Content / Creative",
      requestedBy: "RMB content operations",
      outputFormats: ["Excel"],
      sections: ["Channel", "Asset type", "Locale", "Owner", "Rollout target", "Compliance evidence"],
      previewItems: [
        `${requirements.length} content requirements`,
        `${channels.length} channels: ${channels.join(", ")}`,
        `${locales.length || 1} locale scope`
      ],
      sourceInputs: ["Campaign plan", "Content scope", "Paid media/HOL/email/organic strategies"],
      handoffTarget: "Content",
      approvalLevel: "object-and-final",
      status: "in-review"
    },
    {
      id: "cp3-storyboard",
      title: "Storyboard Package",
      workspace: "Content Planning",
      gate: "H2",
      owner: "Content / Creative",
      requestedBy: "RMB creative team",
      outputFormats: ["PPTX", "Figma mock"],
      sections: ["Frames", "Scripts", "Shot list", "Production plan", "Channel adaptation"],
      previewItems: [
        `${channels.length} channel storyboard lanes`,
        "Script and shot-list scaffold",
        "Production notes for copy, image, video, and compliance"
      ],
      sourceInputs: ["Creative concept", "Requirements matrix", "Figma placeholders"],
      handoffTarget: "Content",
      approvalLevel: "object-and-final",
      status: "draft"
    },
    {
      id: "cp4-figma-mapping",
      title: "Figma Board Mapping",
      workspace: "Content Planning",
      gate: "H2",
      owner: "Content / Creative",
      requestedBy: "RMB Figma mapping team",
      outputFormats: ["Figma mock", "Mapping table"],
      sections: ["Figma frames", "Placeholders", "Asset scope", "Format ratios", "Content object links"],
      previewItems: [
        `${channels.length} Figma frame groups`,
        `${requirements.length} placeholders mapped to production objects`,
        "Sync Panda requirements to an existing Figma file or MCP-created board"
      ],
      sourceInputs: ["Content requirement matrix", "Figma template/layouts", "Channel asset scope"],
      handoffTarget: "Content",
      approvalLevel: "object-and-final",
      status: "draft"
    }
  ]);
}

export function contentPlanningBridgeReadiness(bridge: ContentPlanningBridge): ContentPlanningBridgeReadiness {
  const packages = [bridge.creativeConcept, bridge.requirements, bridge.storyboard, bridge.figmaBoard];
  const approved = packages.filter((item) => item.status === "approved").length;
  return {
    approved,
    total: 4,
    readyForH2: approved === 4,
    pending: packages.filter((item) => item.status !== "approved").map((item) => item.title)
  };
}

export function buildPlanPreviewSlides(view: Extract<AppView, "campaign-planning" | "content-planning">, plan: CampaignPlan, requirements: ContentRequirement[]): PlanPreviewSlide[] {
  if (view === "content-planning") {
    return [
      {
        kicker: "Content leadership preview",
        title: `${plan.name} content plan`,
        bullets: [`${requirements.length} requirements`, `${new Set(requirements.map((item) => item.channel)).size} channels`, `${plan.locales.length} locales`]
      },
      {
        kicker: "Content planning",
        title: "Content Requirement Matrix",
        bullets: requirements.slice(0, 5).map((item) => `${item.channel}: ${item.assetType} (${item.locale})`)
      },
      {
        kicker: "Creative and production",
        title: "Figma, localization, and evidence",
        bullets: ["Figma mapping required for production assets", "Locale variants feed market review", "Compliance evidence travels with each content object"]
      },
      {
        kicker: "Leadership decision",
        title: "Decision Ask",
        bullets: ["Approve content direction", "Confirm audience and locale priorities", "Confirm content risks before rollout build"]
      }
    ];
  }

  return [
    {
      kicker: "H1 leadership preview",
      title: plan.name,
      bullets: [`Campaign theme: ${campaignThemeForPlan(plan)}`, `Markets: ${plan.markets.join(", ")}`, `Budget: ${plan.budget}`]
    },
    {
      kicker: "Campaign strategy",
      title: "Audience, objective, and channels",
      bullets: [`Audience: ${plan.audience.join(" / ")}`, `Channels: ${plan.channels.map((item) => item.name).join(", ")}`, `Locales: ${plan.locales.join(", ")}`]
    },
    {
      kicker: "Measurement",
      title: "KPIs and assumptions",
      bullets: [...plan.kpis.slice(0, 3), ...plan.assumptions.slice(0, 1)]
    },
    {
      kicker: "Leadership decision",
      title: "Decision Ask",
      bullets: ["Approve H1 campaign direction", "Confirm budget and audience priority", "Authorize Content Planning to build the H2 matrix"]
    }
  ];
}

export function simulatedPlanDeckFilename(view: Extract<AppView, "campaign-planning" | "content-planning">, campaignId: string, version: number) {
  const packet = view === "campaign-planning" ? "H1-leadership-plan" : "H2-content-plan";
  return `${campaignId}-${packet}-v${version}.pptx`;
}

export function buildLeadershipFeedbackProposal(view: Extract<AppView, "campaign-planning" | "content-planning">, feedback: string): LeadershipFeedbackProposal {
  const normalized = feedback.toLowerCase();
  const changes: LeadershipFeedbackChange[] = [];

  if (normalized.includes("mocn")) {
    changes.push({
      id: "add-mocn-content",
      action: "add-content-requirement",
      label: "Add MOCN audience content",
      detail: view === "content-planning"
        ? "Add a MOCN audience-only requirement to the Content Planning matrix."
        : "Add MOCN audience priority to the H1 plan and flag downstream content impact."
    });
  }
  if (normalized.includes("kpi") || normalized.includes("measurement")) {
    changes.push({
      id: "clarify-kpi",
      action: "revise-plan-note",
      label: "Clarify KPI language",
      detail: "Add a leadership-facing note that KPI ownership and measurement source must be confirmed before gate approval."
    });
  }
  if (normalized.includes("audience") && !changes.some((item) => item.id === "add-mocn-content")) {
    changes.push({
      id: "revise-audience",
      action: "revise-audience",
      label: "Revise audience section",
      detail: "Update the plan preview audience section from leadership feedback."
    });
  }
  if (normalized.includes("risk") || normalized.includes("legal") || normalized.includes("compliance")) {
    changes.push({
      id: "flag-leadership-risk",
      action: "flag-risk",
      label: "Add leadership risk note",
      detail: "Add a visible risk note for gate review."
    });
  }

  return {
    summary: `${changes.length} proposed change${changes.length === 1 ? "" : "s"} from leadership feedback.`,
    changes
  };
}

function planningObject(
  id: PlanningWorkObject["id"],
  title: PlanningWorkObject["title"],
  lane: PlanningWorkObject["lane"],
  owner: UserRole,
  status: WorkObjectStatus,
  copy: string,
  evidence: string[]
): PlanningWorkObject {
  return {
    id,
    title,
    lane,
    owner,
    status,
    gate: "H1",
    copy,
    evidence,
    source: "CampaignPlan"
  };
}

export function createContentWorkObjectsFromRequirements(requirements: ContentRequirement[]): ContentWorkObject[] {
  return requirements.map((item, index) => {
    const isClaim = item.channel === "Claims";
    const status: WorkObjectStatus = isClaim ? "blocked" : index % 3 === 0 ? "in-review" : "draft";
    return {
      id: item.id,
      channel: item.channel,
      type: item.assetType,
      title: item.locale === "master" ? item.title : `${item.locale} ${item.title}`,
      owner: item.owner,
      status,
      gate: "H2",
      copy: copyForRequirement(item),
      comments: [commentForRequirement(item)],
      evidence: [...item.evidence, "Content Planning matrix"],
      actions: isClaim
        ? ["Comment", "Edit", "Ask AI to revise", "Request revision", "Flag compliance", "Attach evidence"]
        : ["Comment", "Edit", "Ask AI to revise", "Approve", "Request revision", "Flag compliance", "Attach evidence"]
    };
  });
}

export function contentCreationDeliverables(objects: ContentWorkObject[]): RmbDeliverable[] {
  const countByChannel = (channel: ContentWorkObject["channel"]) => objects.filter((item) => item.channel === channel).length;
  const detailsForChannels = (channels: ContentWorkObject["channel"][]) =>
    objects
      .filter((item) => channels.includes(item.channel))
      .slice(0, 5)
      .map((item) => ({ label: item.title, value: `${item.type}: ${item.copy}` }));
  const notesForChannels = (channels: ContentWorkObject["channel"][]) =>
    objects
      .filter((item) => channels.includes(item.channel))
      .flatMap((item) => item.evidence)
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, 4)
      .map((evidence) => `Uses ${evidence}`);
  const paidCount = countByChannel("Paid Media");
  const organicCount = countByChannel("Organic / HN");
  const landingCount = countByChannel("HOL Landing Page") + countByChannel("Banner");
  const emailCount = countByChannel("Email");
  const claimCount = countByChannel("Claims");
  const commonSources = ["Content Planning matrix", "Creative concept", "Figma placeholders"];

  return withRmbDeliverableDefaults([
    {
      id: "paid-media-copy",
      title: "Paid Media Copy Package",
      workspace: "Content",
      gate: "H2",
      owner: "Paid Media",
      requestedBy: "RMB paid media copy team",
      outputFormats: ["Figma board", "Excel"],
      sections: ["Post copy", "On-asset copy", "Ad formats", "Audience fit", "Claims evidence"],
      previewItems: [`${paidCount} paid-media content objects`, "Copywriter-ready Figma placeholder scope", "Per-format copy revision and approval"],
      sourceInputs: [...commonSources, "Paid media strategy"],
      handoffTarget: "Rollout",
      approvalLevel: "object-and-final",
      status: paidCount ? "in-review" : "blocked",
      artifactDetails: detailsForChannels(["Paid Media"]),
      discussionNotes: notesForChannels(["Paid Media"]),
      workspaceAction: "Open paid media copy objects"
    },
    {
      id: "organic-hn-content",
      title: "Organic Social / Hilti Network Content",
      workspace: "Content",
      gate: "H2",
      owner: "Content / Creative",
      requestedBy: "RMB organic/HN content team",
      outputFormats: ["Figma board", "Excel"],
      sections: ["Owned social copy", "HN copy", "Creative concept", "Format", "Dimensions"],
      previewItems: [`${organicCount} organic/HN content objects`, "Owned vs Hilti Network nuance", "Sprinklr/HN-ready asset plan"],
      sourceInputs: [...commonSources, "Organic/HN strategy"],
      handoffTarget: "Rollout",
      approvalLevel: "object-and-final",
      status: organicCount ? "draft" : "blocked"
    },
    {
      id: "landing-page-mockup",
      title: "Landing Page Copy & Mockup",
      workspace: "Content",
      gate: "H2",
      owner: "HOL",
      requestedBy: "RMB landing page team",
      outputFormats: ["Figma mock", "Contentful preview"],
      sections: ["LP copy", "Template sections", "Image/graphic needs", "UX journey fit", "Contentful rebuild notes"],
      previewItems: [`${landingCount} HOL/banner objects`, "Figma layout source carried to Contentful", "LP and banner evidence before rollout"],
      sourceInputs: [...commonSources, "HOL journey map", "Landing page layout"],
      handoffTarget: "Rollout",
      approvalLevel: "object-and-final",
      status: landingCount ? "draft" : "blocked"
    },
    {
      id: "email-copy",
      title: "Email Copy & Mockup",
      workspace: "Content",
      gate: "H2",
      owner: "Email TA",
      requestedBy: "RMB email copy team",
      outputFormats: ["Figma mock", "Excel"],
      sections: ["Email copy", "Module role", "Messaging strategy", "Sequence fit", "Testing notes"],
      previewItems: [`${emailCount} email content objects`, "Mockup-to-basefile path", "Journey role per email preserved"],
      sourceInputs: [...commonSources, "Email strategy & TA brief", "Email templates"],
      handoffTarget: "Rollout",
      approvalLevel: "object-and-final",
      status: emailCount ? "draft" : "blocked"
    },
    {
      id: "email-basefile",
      title: "Email Basefile Creator",
      workspace: "Content",
      gate: "H2",
      owner: "Email TA",
      requestedBy: "RMB content operations",
      outputFormats: ["XLS"],
      sections: ["Email modules", "Translation rows", "CTA/link fields", "Locale columns", "SFMC handoff"],
      previewItems: [`${emailCount} email objects prepared for XLS basefile`, "Translation/production table preview", "SFMC build handoff after H2"],
      sourceInputs: ["Email mockup", "Figma source", "Email copy package"],
      handoffTarget: "Rollout",
      approvalLevel: "object",
      status: emailCount ? "draft" : "blocked"
    },
    {
      id: "image-assets",
      title: "Image Generation / Editing Package",
      workspace: "Content",
      gate: "H2",
      owner: "Content / Creative",
      requestedBy: "RMB image production team",
      outputFormats: ["Asset manifest", "DAM package"],
      sections: ["Image sources", "Photo/graphic edits", "CAD/3D inputs", "Usage evidence", "DAM readiness"],
      previewItems: ["Photo, graphic, CAD, and 3D source list", "Image-editing status per asset", "DAM package remains mocked"],
      sourceInputs: [...commonSources, "Photographer images", "CAD/3D files"],
      handoffTarget: "DAM / Compliance",
      approvalLevel: "object",
      status: "draft"
    },
    {
      id: "video-assets",
      title: "Video Generation / Editing Package",
      workspace: "Content",
      gate: "H2",
      owner: "Content / Creative",
      requestedBy: "RMB video production team",
      outputFormats: ["Asset manifest", "DAM package"],
      sections: ["Storyboards", "Scripts", "Source videos", "Format variants", "Agency handoff"],
      previewItems: ["9:16, 16:9, 4:5, 1:1 video variant scope", "Scripts captured for later localization", "Agency/open-file handoff tracked"],
      sourceInputs: [...commonSources, "Storyboards/scripts", "Agency video files", "CAD/3D files"],
      handoffTarget: "Rollout",
      approvalLevel: "object",
      status: "draft"
    },
    {
      id: "asset-formatting",
      title: "Asset Formatting Matrix",
      workspace: "Content",
      gate: "H2",
      owner: "Content / Creative",
      requestedBy: "RMB design operations",
      outputFormats: ["Excel", "Asset manifest"],
      sections: ["1:1", "4:5", "9:16", "16:9", "Editable source", "DAM naming"],
      previewItems: ["Static and video ratio matrix", "Format completion per channel", "Editable source files tracked before rollout"],
      sourceInputs: ["Completed assets", "Figma placeholders", "Adobe editable formats"],
      handoffTarget: "Rollout",
      approvalLevel: "object",
      status: "draft"
    },
    {
      id: "compliance-report",
      title: "Compliance Evidence Report",
      workspace: "Content",
      gate: "H2",
      owner: "Legal / Compliance",
      requestedBy: "RMYT / RMB compliance team",
      outputFormats: ["Compliance report", "DAM package"],
      sections: ["Brand rules", "Legal claims", "AI guidelines", "Ready for upload", "Non-compliant sample checks"],
      previewItems: [`${claimCount} claim objects require compliance evidence`, "Dummy compliant/non-compliant assets can validate feasibility", "Future DAM-side agent path preserved"],
      sourceInputs: ["Completed assets", "Brand guidelines", "Legal guidelines", "AI guidelines", "Dummy non-compliant assets"],
      handoffTarget: "DAM / Compliance",
      approvalLevel: "object-and-final",
      status: claimCount ? "blocked" : "draft"
    }
  ]);
}

export function contentWorkspaceReadiness(objects: ContentWorkObject[]): ObjectWorkspaceReadiness {
  const approved = objects.filter((item) => item.status === "approved").length;
  const blocked = objects.filter((item) => item.status === "blocked").length;
  const revision = objects.filter((item) => item.status === "revision-requested").length;
  const total = objects.length;
  return {
    approved,
    total,
    blocked,
    revision,
    pct: total ? Math.round((approved / total) * 100) : 0,
    channels: Array.from(new Set(objects.map((item) => item.channel)))
  };
}

export function createRolloutWorkObjectsFromContent(contentObjects: ContentWorkObject[]): RolloutWorkObject[] {
  const approvedIds = contentObjects.filter((item) => item.status === "approved").map((item) => item.id);
  const idsByChannel = (channels: ContentWorkObject["channel"][]) =>
    contentObjects.filter((item) => channels.includes(item.channel)).map((item) => item.id);
  const hasApprovedContent = approvedIds.length > 0;
  const paidIds = idsByChannel(["Paid Media"]);
  const contentfulIds = idsByChannel(["HOL Landing Page", "Banner", "Claims"]);
  const sprinklrIds = idsByChannel(["Organic / HN"]);
  const sfmcIds = idsByChannel(["Email"]);

  const sourceLanes = [
    rolloutObject("paid-media-rollout", "Paid Media", "Paid media build and QA matrix", "Paid Media", paidIds, hasApprovedContent ? "in-review" : "draft", [
      "Approved H2 content objects",
      "Channel plan",
      "UTM naming rules"
    ]),
    rolloutObject("contentful-rollout", "Contentful", "Contentful HOL page and banner build", "HOL", contentfulIds, hasApprovedContent ? "in-review" : "draft", [
      "Approved H2 content objects",
      "Figma mapping",
      "Contentful page manifest"
    ]),
    rolloutObject("sprinklr-rollout", "Sprinklr", "Sprinklr organic and HN draft posts", "Content / Creative", sprinklrIds, hasApprovedContent ? "draft" : "blocked", [
      "Approved H2 content objects",
      "Sprinklr draft-post checklist"
    ]),
    rolloutObject("sfmc-rollout", "SFMC", "SFMC email and journey build", "Email TA", sfmcIds, hasApprovedContent ? "draft" : "blocked", [
      "Approved H2 content objects",
      "Locale matrix",
      "SFMC journey checklist"
    ])
  ].filter((item) => item.sourceContentIds.length > 0);

  return [
    ...sourceLanes,
    rolloutObject("utm-qa", "UTM / QA", "UTM Create + QA evidence", "Campaign Owner", approvedIds, hasApprovedContent ? "in-review" : "draft", [
      "Approved H2 content objects",
      "Destination URL checks",
      "Paid-media QA"
    ]),
    rolloutObject("publish-readiness", "Publish Readiness", "Held publish manifest for H3", "Campaign Owner", approvedIds, hasApprovedContent ? "in-review" : "blocked", [
      "Approved H2 content objects",
      "H3 gate packet",
      "No auto-publish confirmation"
    ])
  ];
}

export function rolloutWorkspaceReadiness(objects: RolloutWorkObject[]): RolloutWorkspaceReadiness {
  const approved = objects.filter((item) => item.status === "approved").length;
  const blocked = objects.filter((item) => item.status === "blocked").length;
  const revision = objects.filter((item) => item.status === "revision-requested").length;
  const total = objects.length;
  return {
    approved,
    total,
    blocked,
    revision,
    pct: total ? Math.round((approved / total) * 100) : 0,
    lanes: objects.map((item) => item.lane),
    sourceObjects: new Set(objects.flatMap((item) => item.sourceContentIds)).size
  };
}

function buildGateApprovalReadiness(ready: boolean, approved: number, total: number, blockedReason: string): GateApprovalReadiness {
  return {
    ready,
    reason: ready ? "Gate is ready for approval." : blockedReason,
    approved,
    total,
  };
}

export function skillHubSummary(skills: SkillCapability[]): SkillHubSummary {
  return {
    knowledge: skills.filter((item) => item.category === "knowledge").length,
    integrations: skills.filter((item) => item.category === "integration").length,
    active: skills.filter((item) => item.status === "active").length,
    mockOrNeedsSetup: skills.filter((item) => item.status !== "active").length,
    workflowCoverage: Array.from(new Set(skills.flatMap((item) => item.usedBy))) as SkillCapability["usedBy"]
  };
}

export const contentWorkObjects: ContentWorkObject[] = createContentWorkObjectsFromRequirements(
  contentRequirementsFromPlan(campaignPlanForSeed())
);

function campaignPlanForSeed(): CampaignPlan {
  return campaignPlanForRun({
    campaignId: "camp_04",
    name: "Q4 DACH SIW 6AT-A22 paid-media campaign",
    brief: "Plan a DACH paid-media campaign for SIW 6AT-A22 cordless impact wrench.",
    phase: "planning",
    modelMode: "not-run",
    summary: "",
    worklog: [],
    artifacts: [],
    gateDecisions: [],
    nextActions: [],
    updatedAt: ""
  });
}

function campaignPlanFromArtifact(run: CampaignRun): CampaignPlan | undefined {
  const artifact = run.artifacts.find((item) => item.type === "campaign-plan.v3" || item.type === "campaign-plan");
  const data = artifact?.data;
  if (!data || typeof data !== "object") return undefined;
  const record = data as Record<string, unknown>;
  const channels = normalizeChannels(record.channels);
  if (!channels.length) return undefined;

  return {
    campaignId: run.campaignId,
    name: run.name,
    heroProduct: stringValue(record.heroProduct) || inferHeroProduct(run.brief),
    markets: stringArray(record.markets, ["DE", "AT", "CH"]),
    locales: stringArray(record.locales, ["de-DE", "de-AT", "de-CH", "fr-CH"]),
    audience: stringArray(record.audience, ["Contractors", "Specifiers"]),
    budget: stringValue(record.budget) || inferBudget(run.brief),
    timeline: stringValue(record.timeline) || "Launch window; no auto-publish before H3 approval.",
    channels,
    kpis: stringArray(record.kpis, ["Qualified HOL visits", "H3 publish readiness without auto-publish"]),
    assumptions: stringArray(record.assumptions, ["Agent-generated plan normalized by Panda."])
  };
}

function campaignPlanFromBrief(run: CampaignRun): Pick<CampaignPlan, "heroProduct" | "markets" | "locales" | "audience" | "budget" | "channels"> {
  const requestedChannels = inferRequestedChannels(run.brief);
  const markets = inferMarkets(run.brief);
  return {
    heroProduct: inferHeroProduct(run.brief),
    markets,
    locales: inferLocales(run.brief, markets),
    audience: inferAudience(run.brief),
    budget: inferBudget(run.brief),
    channels: defaultPlanChannels().filter((channel) => requestedChannels.size === 0 || requestedChannels.has(channel.name))
  };
}

function defaultPlanChannels(): CampaignPlanChannel[] {
  return [
    {
      id: "paid-media",
      name: "Paid Media",
      owner: "Paid Media",
      objective: "Drive demand and qualified HOL traffic.",
      requiredAssets: ["Search ad headline", "CTA", "Paid social primary text"],
      rolloutTarget: "Paid Media"
    },
    {
      id: "email",
      name: "Email",
      owner: "Email TA",
      objective: "Nurture known audiences.",
      requiredAssets: ["Hero section", "Subject line", "Preview text", "Locale variant"],
      rolloutTarget: "SFMC"
    },
    {
      id: "hol-landing-page",
      name: "HOL Landing Page",
      owner: "HOL",
      objective: "Convert traffic with product proof, offer, and next-step CTA.",
      requiredAssets: ["Opening section", "Value proposition", "CTA module"],
      rolloutTarget: "Contentful"
    },
    {
      id: "organic-hn",
      name: "Organic / HN",
      owner: "Content / Creative",
      objective: "Support launch visibility through owned social and HN placements.",
      requiredAssets: ["Social post", "HN short hook"],
      rolloutTarget: "Sprinklr"
    },
    {
      id: "banner",
      name: "Banner",
      owner: "HOL",
      objective: "Promote launch offer from relevant Hilti web placements.",
      requiredAssets: ["Hardcoded banner copy"],
      rolloutTarget: "Contentful"
    }
  ];
}

function requirement(
  plan: CampaignPlan,
  id: string,
  channel: ContentRequirement["channel"],
  assetType: string,
  title: string,
  locale: ContentRequirement["locale"],
  owner: UserRole,
  rolloutTarget: ContentRequirement["rolloutTarget"]
): ContentRequirement {
  return {
    id,
    channel,
    assetType,
    title,
    locale,
    owner,
    source: "Content Planning matrix",
    evidence: ["Campaign plan", "Brand Playbook", plan.audience.includes("Contractors") ? "Audience / Persona Files" : "Campaign Brief"],
    compliance: channel === "Claims" ? "Requires source-backed claim review before H2." : "Requires brand, tone, and locale fit check before H2.",
    rolloutTarget
  };
}

function copyForRequirement(item: ContentRequirement): string {
  if (item.channel === "Claims") return "High torque for demanding anchor and fastening tasks.";
  if (item.channel === "Paid Media" && item.assetType === "Search ad headline") return `Drive demand with ${item.title}.`;
  if (item.channel === "Paid Media" && item.assetType === "CTA") return "Explore the SIW 6AT-A22";
  if (item.channel === "Email" && item.locale === "fr-CH") return "Variant copy ready for localization review.";
  if (item.channel === "Email") return "A new way to power through demanding fastening work.";
  if (item.channel === "HOL Landing Page") return "Cordless impact performance for demanding jobsites.";
  if (item.channel === "Organic / HN") return "For teams who need impact power without a cord, meet SIW 6AT-A22.";
  if (item.channel === "Banner") return "Upgrade your cordless impact setup.";
  return "Draft content generated from the content planning matrix.";
}

function commentForRequirement(item: ContentRequirement): string {
  if (item.channel === "Claims") return "Needs exact source before approving performance language.";
  if (item.locale !== "master") return "Locale tone should stay close to DACH master copy.";
  return `${item.assetType} created from ${item.source}; verify evidence before approval.`;
}

function rolloutObject(
  id: string,
  lane: RolloutWorkObject["lane"],
  title: string,
  owner: UserRole,
  sourceContentIds: string[],
  status: WorkObjectStatus,
  evidence: string[]
): RolloutWorkObject {
  return {
    id,
    lane,
    title,
    owner,
    status,
    gate: "H3",
    sourceContentIds,
    evidence,
    actions: ["Review handoff", "Attach evidence", "Ask Panda to build", "Request revision", "Mark ready for H3"]
  };
}

function normalizeChannels(value: unknown): CampaignPlanChannel[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const name = normalizeChannelName(record.name);
    if (!name) return [];
    return [{
      id: stringValue(record.id) || slug(name),
      name,
      owner: normalizeOwner(record.owner, name),
      objective: stringValue(record.objective) || `Build ${name} campaign work.`,
      requiredAssets: stringArray(record.requiredAssets, defaultAssetsForChannel(name)),
      rolloutTarget: normalizeRolloutTarget(record.rolloutTarget, name)
    }];
  });
}

function channelsFromHomeDraft(channels: string[]): CampaignPlanChannel[] {
  const normalized = normalizeChannels(channels.map((name) => ({ name })));
  return normalized.length ? normalized : defaultPlanChannels();
}

function normalizeChannelName(value: unknown): CampaignPlanChannel["name"] | undefined {
  const text = stringValue(value).toLowerCase();
  if (!text) return undefined;
  if (text.includes("paid") || text.includes("linkedin") || text.includes("meta") || text.includes("google")) return "Paid Media";
  if (text.includes("email") || text.includes("sfmc")) return "Email";
  if (text.includes("hol") || text.includes("landing")) return "HOL Landing Page";
  if (text.includes("organic") || text.includes("social") || text.includes("hn")) return "Organic / HN";
  if (text.includes("banner")) return "Banner";
  return undefined;
}

function normalizeOwner(value: unknown, channel: CampaignPlanChannel["name"]): UserRole {
  const text = stringValue(value) as UserRole;
  if (["Campaign Owner", "Paid Media", "Content / Creative", "HOL", "Email TA", "Legal / Compliance", "Leadership / Approver"].includes(text)) return text;
  if (channel === "Paid Media") return "Paid Media";
  if (channel === "Email") return "Email TA";
  if (channel === "HOL Landing Page" || channel === "Banner") return "HOL";
  return "Content / Creative";
}

function normalizeRolloutTarget(value: unknown, channel: CampaignPlanChannel["name"]): CampaignPlanChannel["rolloutTarget"] {
  const text = stringValue(value);
  if (["Paid Media", "Contentful", "Sprinklr", "SFMC"].includes(text)) return text as CampaignPlanChannel["rolloutTarget"];
  if (channel === "Email") return "SFMC";
  if (channel === "HOL Landing Page" || channel === "Banner") return "Contentful";
  if (channel === "Organic / HN") return "Sprinklr";
  return "Paid Media";
}

function defaultAssetsForChannel(channel: CampaignPlanChannel["name"]) {
  return defaultPlanChannels().find((item) => item.name === channel)?.requiredAssets ?? ["Content module"];
}

function inferRequestedChannels(brief: string) {
  const text = brief.toLowerCase();
  if (!/channels?\s+/i.test(brief)) return new Set<CampaignPlanChannel["name"]>();
  const channels = new Set<CampaignPlanChannel["name"]>();
  if (text.includes("linkedin") || text.includes("paid") || text.includes("meta") || text.includes("google")) channels.add("Paid Media");
  if (text.includes("email")) channels.add("Email");
  if (text.includes("hol") || text.includes("landing")) channels.add("HOL Landing Page");
  if (text.includes("organic") || text.includes("social") || text.includes("hn")) channels.add("Organic / HN");
  if (text.includes("banner")) channels.add("Banner");
  return channels;
}

function inferDelimitedList(brief: string, pattern: RegExp, fallback: string[]) {
  const match = brief.match(pattern);
  if (!match?.[1]) return fallback;
  return match[1].split(",").map((item) => item.trim()).filter(Boolean);
}

function inferBudget(brief: string) {
  if (/\bbudget\b/i.test(brief) && /\b(after|defined after|to be defined|later)\b/i.test(brief)) {
    return "To be defined after Campaign Planning and Content Planning review";
  }
  const match = brief.match(/\b(EUR|USD|CHF|GBP)\s*([0-9]+(?:k|K|,[0-9]{3})?)/);
  return match ? `${match[1].toUpperCase()} ${match[2].toLowerCase()}` : "EUR 50k";
}

function inferAudience(brief: string) {
  if (/\bcold cut\b/i.test(brief)) return ["Contractors", "Installers", "Trade buyers"];
  const match = brief.match(/(?:for|target)\s+([^.]+?)(?:\.| budget| markets| locales| channels| no auto-publish|$)/i);
  if (!match?.[1]) return ["Contractors", "Specifiers"];
  const clean = cleanCampaignSubject(match[1].replace(/\b(first|second|primary|secondary)\b/gi, "").trim());
  return clean ? [sentenceCase(clean)] : ["Contractors", "Specifiers"];
}

function inferHeroProduct(brief: string) {
  const lower = brief.toLowerCase();
  if (lower.includes("firestop")) return "firestop";
  if (lower.includes("measuring")) return "measuring tools";
  if (lower.includes("siw 6at-a22")) return "SIW 6AT-A22";
  const product = extractProductMention(brief) || cleanCampaignSubject(extractCampaignSubject(brief));
  return product || "power tools";
}

function inferMarkets(brief: string) {
  if (/\b(global|all markets|all the markets|worldwide)\b/i.test(brief)) return ["Global markets"];
  const match = brief.match(/\bmarkets?\s+([A-Za-z]{2}(?:\s*,\s*[A-Za-z]{2})*)\b/i);
  const codes = match?.[1]
    ?.split(",")
    .map((item) => item.trim())
    .filter((item) => /^[A-Z]{2}$/.test(item));
  return codes?.length ? codes : ["DE", "AT", "CH"];
}

function inferLocales(brief: string, markets: string[]) {
  const explicit = inferDelimitedList(brief, /\blocales?\s+([a-z]{2}-[A-Z]{2}(?:\s*,\s*[a-z]{2}-[A-Z]{2})*)\b/i, []);
  if (explicit.length) return explicit;
  if (markets.includes("Global markets")) return ["Market-localized variants TBD"];
  return ["de-DE", "de-AT", "de-CH", "fr-CH"];
}

function titleForAsset(heroProduct: string, channel: CampaignPlanChannel["name"], asset: string) {
  if (channel === "Paid Media" && asset === "Search ad headline") return `${titleCase(heroProduct)} search headline`;
  if (channel === "Paid Media" && asset === "CTA") return `${titleCase(heroProduct)} CTA`;
  if (channel === "Email") return `${titleCase(heroProduct)} email ${asset.toLowerCase()}`;
  if (channel === "HOL Landing Page") return `${titleCase(heroProduct)} landing page ${asset.toLowerCase()}`;
  if (channel === "Organic / HN") return `${titleCase(heroProduct)} ${asset.toLowerCase()}`;
  if (channel === "Banner") return `${titleCase(heroProduct)} banner copy`;
  return `${titleCase(heroProduct)} ${asset.toLowerCase()}`;
}

function stringArray(value: unknown, fallback: string[]) {
  if (!Array.isArray(value)) return fallback;
  const normalized = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  return normalized.length ? normalized : fallback;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => {
    if (/[A-Z]{2,}|\d/.test(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  });
}

function sentenceCase(value: string) {
  const clean = value.trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function hasRuntimeRecords(value: unknown, evidenceKeys: string[]): boolean {
  return Array.isArray(value) && value.some((item) => {
    if (!isRecord(item)) return false;
    return evidenceKeys.some((key) => Boolean(stringValue(item[key])));
  });
}

export const backlogStories = [
  ["E1-S1", "Brief Intake", "A0", "P0", "R-1"],
  ["E1-S2", "Paid-Media Advisor", "A1", "P0", "R-1"],
  ["E1-S3", "Paid-Media Planning", "A2", "P0", "R-1"],
  ["E2-S1", "Creative Concept", "CP1", "P0", "R-1"],
  ["E2-S2", "Cross-Channel Requirements", "CP2", "P0", "R-1"],
  ["E2-S3", "Storyboarding", "CP3", "P0", "R-1"],
  ["E2-S4", "Figma Mapping", "CP4", "P0", "R-1"],
  ["E3-S1", "Ad Copy", "C1", "P0", "R-1"],
  ["E3-S2", "Compliance", "C2", "P1", "R-1"],
  ["E3-S4", "Image Creation", "C4", "P0", "R-1"],
  ["E4-S10", "UTM Create + QA", "R10", "P0", "R-1"],
  ["E4-S11", "Paid-Media QA", "R11", "P0", "R-1"]
] as const;

export const defaultBrief =
  "Plan a DACH paid-media campaign for SIW 6AT-A22 cordless impact wrench. Budget EUR 50k. Markets DE, AT, CH. Locales de-DE, de-AT, de-CH, fr-CH. Target contractors first, specifiers second. No auto-publish.";

export function createDefaultRun(overrides: Partial<CampaignRun> = {}): CampaignRun {
  const now = new Date().toISOString();
  return {
    campaignId: "camp_04",
    name: "Q4 DACH SIW 6AT-A22 paid-media campaign",
    brief: defaultBrief,
    phase: "planning",
    modelMode: "not-run",
    summary: "Create a campaign, run each phase with Panda, review the key decisions, and preserve the trace.",
    worklog: [
      {
        id: crypto.randomUUID(),
        agent: "orchestrator",
        status: "queued",
        message: "Ready to run the R-1 paid-media spine.",
        phase: "planning",
        createdAt: now
      }
    ],
    artifacts: [],
    gateDecisions: [],
    nextActions: ["Run planning", "Review campaign planning", "Revise or mark ready"],
    updatedAt: now,
    ...overrides
  };
}

export function createCampaignFromBrief(brief: string): CampaignRun {
  const now = new Date().toISOString();
  const id = `camp_${now.slice(2, 10).replace(/-/g, "")}_${Math.random().toString(36).slice(2, 6)}`;
  const name = inferCampaignName(brief);
  return createDefaultRun({
    campaignId: id,
    name,
    brief,
    phase: "planning",
    modelMode: "not-run",
    summary: "New campaign created. Panda is ready to structure the brief and generate the campaign planning draft.",
    worklog: [
      {
        id: crypto.randomUUID(),
        agent: "panda-agent",
        status: "queued",
        message: "New campaign created from human brief.",
        phase: "planning",
        createdAt: now
      }
    ],
    artifacts: [],
    gateDecisions: [],
    currentGate: undefined,
    nextActions: ["Review campaign planning draft", "Review assumptions", "Revise or mark ready"],
    updatedAt: now
  });
}

export function createCampaignFromHomeDraft(draft: HomeCampaignDraft, originalPrompt = ""): CampaignRun {
  const now = new Date().toISOString();
  const id = `camp_${now.slice(2, 10).replace(/-/g, "")}_${Math.random().toString(36).slice(2, 6)}`;
  const name = cleanCampaignSubject(draft.campaignName) || sentenceCase(draft.heroProduct || "New campaign");
  const channels = channelsFromHomeDraft(draft.channels);
  const assumptions = [
    draft.timingAssumptions,
    ...draft.missingInputs.map((item) => `Missing input: ${item}`),
    ...draft.sourceEvidence.map((item) => `Source evidence: ${item}`)
  ].filter(Boolean);
  const brief = [
    `Campaign: ${name}`,
    `Objective: ${draft.objective}`,
    `Hero product: ${draft.heroProduct}`,
    `Audience: ${draft.audience.join(", ")}`,
    `Markets: ${draft.markets.join(", ")}`,
    `Budget: ${draft.budgetAssumptions}`,
    originalPrompt ? "Original request is retained in the Home Panda conversation." : undefined
  ].filter(Boolean).join("\n");

  return createDefaultRun({
    campaignId: id,
    name,
    brief,
    phase: "planning",
    modelMode: "deepseek",
    summary: "New campaign created from Panda's reviewed Home draft. Campaign Planning is ready for revision and owner review.",
    worklog: [
      {
        id: crypto.randomUUID(),
        agent: "home-orchestrator",
        status: "done",
        message: "Created campaign from structured Home draft.",
        phase: "planning",
        createdAt: now
      }
    ],
    artifacts: [
      {
        id: crypto.randomUUID(),
        name: `${name} Campaign Plan`,
        type: "campaign-plan.v3",
        content: draft.objective,
        phase: "planning",
        createdAt: now,
        data: {
          heroProduct: draft.heroProduct,
          markets: draft.markets,
          locales: draft.locales,
          audience: draft.audience,
          budget: draft.budgetAssumptions,
          timeline: draft.timingAssumptions,
          channels,
          kpis: draft.kpiCandidates,
          assumptions
        },
        tool: "Panda Home Orchestrator",
        owner: "Campaign Owner",
        integrationMode: "API",
        authority: "draft-write",
        gate: "H1",
        evidence: "Structured Home draft reviewed by user before create"
      }
    ],
    gateDecisions: [],
    currentGate: undefined,
    nextActions: ["Review campaign planning draft", "Refine assumptions", "Prepare plan for leadership review"],
    updatedAt: now
  });
}

export function createDefaultWorkspace(): CampaignWorkspace {
  const existing = createDefaultRun({
    summary: "Existing campaign loaded. camp_04 is available for review, replay, or continuation.",
    modelMode: "fixture",
    artifacts: [
      {
        id: crypto.randomUUID(),
        name: "Existing Brief Snapshot",
        type: "a0-structured-brief",
        content: "DACH SIW 6AT-A22 campaign, EUR 50k, contractors primary, specifiers secondary.",
        phase: "planning",
        createdAt: new Date().toISOString(),
        data: { status: "existing", source: "seed" },
        tool: "PowerPoint / SharePoint",
        owner: "Campaign Planning Owner",
        integrationMode: "manual",
        authority: "source-of-truth",
        gate: "H1",
        evidence: "Existing seeded brief snapshot"
      }
    ]
  });

  return {
    activeCampaignId: existing.campaignId,
    campaigns: [existing],
    messages: {
      [existing.campaignId]: [
        {
          id: crypto.randomUUID(),
          role: "system",
          text: "camp_04 is an existing campaign. Create a new campaign when you want Panda to start from a fresh brief.",
          timestamp: new Date().toISOString()
        }
      ]
    }
  };
}

export function phaseIndex(phase: PhaseId) {
  return phases.findIndex((item) => item.id === phase);
}

export function nextPhase(phase: PhaseId): PhaseId {
  return phase === "planning" ? "content" : phase === "content" ? "rollout" : phase === "rollout" ? "optimize" : "optimize";
}

export function currentPhaseMeta(phase: PhaseId) {
  return phases.find((item) => item.id === phase) ?? phases[0];
}

function inferCampaignName(brief: string) {
  const compact = brief.replace(/\s+/g, " ").trim();
  if (!compact) return "Untitled campaign";
  const product = compact.match(/\b(SIW|TE|NURON|BX|PMD|HIT|EXO)[A-Z0-9 -]*/i)?.[0]?.trim();
  const subject = product ? undefined : formatCampaignSubject(extractCampaignSubject(compact));
  const market = compact.match(/\b(DACH|DE|AT|CH|EU|global|APAC|North America)\b/i)?.[0];
  const audience = compact.match(/\b(contractors?|installers?|specifiers?|MOCN|electricians?|plumbers?)\b/i)?.[0];
  const parts: string[] = [];
  if (product) parts.push(product);
  else if (subject) parts.push(subject);
  if (market && product) parts.push(market.toUpperCase());
  else if (audience) parts.push(audience.charAt(0).toUpperCase() + audience.slice(1));
  if (parts.length === 0) {
    // Fallback: first meaningful words from the brief
    const words = compact.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).filter((w) => w.length > 2 && !/\b(the|and|for|with|this|that|from|will|have|has|been|campaign)\b/i.test(w));
    return words.slice(0, 3).join(" ") || compact.slice(0, 48);
  }
  return parts.join(" · ");
}

function formatCampaignSubject(subject?: string) {
  const cleaned = subject
    ?.replace(/https?:\/\/\S+/gi, "")
    .replace(/\b(the products? you can check here|products? you can check here)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;
  return cleaned
    .split(" ")
    .slice(0, 6)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
