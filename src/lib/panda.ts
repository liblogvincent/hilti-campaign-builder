export type PhaseId = "planning" | "content" | "rollout" | "optimize";
export type Status = "done" | "running" | "blocked" | "queued";
export type GateId = "H1" | "H2" | "H3" | "H4" | "H-C" | "H-legal";
export type AgentMode = "deepseek" | "fixture";
export type AgentWorkMode = "Plan" | "Build";
export type AppView =
  | "home"
  | "progress"
  | "campaign-planning"
  | "content-planning"
  | "content"
  | "rollout"
  | "optimize"
  | "skills";
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
};

export type AgentMessage = {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
  timestamp: string;
};

export type HomeIntent =
  | { type: "chat" }
  | { type: "status" }
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
    };

export type SpecialistAgentResponse = {
  answer: string;
  updates: SpecialistAgentUpdate[];
  suggested_actions: string[];
  route?: AppView;
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
  role: "orchestrator" | "campaign-planning-specialist" | "content-planning-specialist" | "content-specialist" | "rollout-specialist" | "optimization-specialist";
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
    description: "Turn the brief into the H1 campaign plan packet: objective, audience, channels, KPIs, budget, risks, and downstream handoff."
  },
  {
    id: "content",
    label: "Content",
    agents: "CP1 CP2 CP3 CP4 C1 C2 C4",
    gate: "H2",
    description: "Turn the approved H1 plan into channel-by-asset requirements before Content builds each piece."
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
    backlogCoverage: "Covered by E2-S4/CP4",
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
  if (!text) return { type: "chat" };
  const route = routeIntent(text);
  if (route) return { type: "route", view: route };
  if (/\b(status|progress|blocked|blocker|missing|ready|where are we)\b/.test(text)) return { type: "status" };
  if (/\b(update|change|revise|adjust|edit)\b/.test(text) && /\b(campaign|plan|planning|brief|objective|audience|kpi|budget|channel)\b/.test(text)) {
    return { type: "update-campaign" };
  }
  if (/\b(create|start|launch|build|plan)\b/.test(text) && /\bcampaign\b/.test(text)) return { type: "create-campaign" };
  return { type: "chat" };
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

export function visibleWorkspaceMessages(shared: AgentMessage[], local: AgentMessage[]) {
  const seen = new Set<string>();
  return [...shared, ...local].filter((message) => {
    const key = `${message.role}:${message.text}`;
    if (seen.has(message.id) || seen.has(key)) return false;
    seen.add(message.id);
    seen.add(key);
    return true;
  });
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
      role: "content-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["revise_copy", "check_compliance", "attach_evidence", "prepare_h2", "route_workspace"]
    };
  }
  if (view === "content-planning") {
    return {
      role: "content-planning-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["build_requirements", "check_figma_mapping", "find_locale_gaps", "prepare_h2"]
    };
  }
  if (view === "campaign-planning") {
    return {
      role: "campaign-planning-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["draft_objective", "find_h1_gaps", "build_h1_packet", "route_workspace"]
    };
  }
  if (view === "rollout") {
    return {
      role: "rollout-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["check_connectors", "prepare_h3", "build_publish_manifest", "verify_no_auto_publish"]
    };
  }
  if (view === "optimize") {
    return {
      role: "optimization-specialist",
      surface: view,
      selected_object_id: selectedObjectId,
      allowed_actions: ["analyze_performance", "recommend_optimization", "prepare_h4", "promote_learning_candidate"]
    };
  }
  return {
    role: "orchestrator",
    surface: view,
    selected_object_id: selectedObjectId,
    allowed_actions: ["create_campaign", "route_workspace", "explain_status", "find_blockers"]
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
    return `Campaign Planning Panda: I am using the shared campaign context for ${context.campaign_name}. For ${gate}, I will check objective, audience, channels, KPIs, budget, risks, and missing H1 inputs. Your question was: "${trimmedQuestion}". DeepSeek is refining this answer in the background.`;
  }
  if (view === "content-planning") {
    return `Content Planning Panda: I see ${context.content_requirements.length} requirements from the H1 plan for ${gate}. I will check channel, locale, Figma mapping, compliance, and rollout target coverage for your question: "${trimmedQuestion}". DeepSeek is refining this answer in the background.`;
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
    const updates = planningUpdatesFromInstruction(context.planning_objects, question);
    const changedTitles = updates.map((update) => context.planning_objects.find((item) => item.id === update.id)?.title || update.id);
    return {
      answer: changedTitles.length
        ? `Campaign Planning Panda updated the H1 plan draft for ${context.campaign_name}: ${changedTitles.join(", ")}. No approval was taken; this is a planning revision for review.`
        : `Campaign Planning Panda is staying in H1 plan editing mode for ${context.campaign_name}. I can revise objective, audience, KPIs, budget, channels, risks, and missing inputs without approving the gate.`,
      updates,
      suggested_actions: ["Review H1 plan changes", "Ask Panda to revise another planning object", "Prepare H1 packet when ready"],
      route: "campaign-planning"
    };
  }
  if (view === "content-planning") {
    const updatedRequirements = applyContentPlanningInstruction(context.content_requirements as ContentRequirement[], context.campaign_plan, question);
    const changed = updatedRequirements !== context.content_requirements;
    return {
      answer: changed
        ? "Content Planning Panda updated the CP bridge requirements and kept the change scoped to Content Planning. Downstream Content objects should refresh from the revised matrix."
        : draftWorkspaceAgentAnswer(view, question, context),
      updates: changed ? [{ target: "content_requirements", action: "replace", requirements: updatedRequirements }] : [],
      suggested_actions: ["Review CP1-CP4 package", "Open Requirements Matrix", "Prepare H2 after object approvals"],
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
      ["Brief intake", "H1 Campaign Plan"]
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
  const productMatch = text.match(/\b(?:focus on|for|about|to)\s+([A-Z]{1,5}\d{1,3}(?:-\d{1,3})?|TE\d{2}(?:-\d{2})?|SIW\s*6AT-A22)\b/i);
  const product = productMatch?.[1]?.toUpperCase().replace(/\s+/g, " ");
  const mentionsMocn = /\bmocn\b/i.test(text);
  const wantsUpdate = /\b(update|change|revise|adjust|edit|focus)\b/i.test(text);
  if (!wantsUpdate && !product && !mentionsMocn) return [];

  const updates: Extract<SpecialistAgentUpdate, { target: "planning_object" }>[] = [];
  const objective = objects.find((item) => item.id === "campaign-objective");
  if (objective && (product || wantsUpdate)) {
    updates.push({
      target: "planning_object",
      id: objective.id,
      patch: {
        status: "revision-requested",
        copy: product
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

export function buildContentPlanningBridge(plan: CampaignPlan, requirements: ContentRequirement[]): ContentPlanningBridge {
  const channels = Array.from(new Set(requirements.map((item) => item.channel)));
  const hero = plan.heroProduct;
  return {
    creativeConcept: {
      storyId: "CP1",
      title: "Creative Concept",
      status: "in-review",
      head: `${hero} helps ${plan.audience[0] || "the target audience"} reduce friction with measurable jobsite confidence.`,
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
      productionPlan: ["Confirm claims with Compliance", "Map visual idea to Figma placeholders", "Prepare static mockups for H2 review"]
    },
    figmaBoard: {
      storyId: "CP4",
      title: "Figma Board Mapping",
      status: "draft",
      mappingStatus: "ready-to-create",
      figmaUrl: "https://figma.com/file/panda-cp4-placeholder",
      frames: channels.map((channel) => ({
        id: `figma-${slug(channel)}`,
        name: `${channel} master placeholders`,
        channel,
        placeholderCount: requirements.filter((item) => item.channel === channel).length,
        ratio: channel === "Paid Media" ? "1:1 / 4:5 / 16:9" : channel === "Email" ? "Email module" : "Responsive module"
      })),
      actions: ["Create Figma Mapping", "Open Figma", "Sync placeholders to Content"]
    }
  };
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
        kicker: "H2 leadership preview",
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
        bullets: ["Approve H2 direction", "Confirm audience and locale priorities", "Confirm content risks before rollout build"]
      }
    ];
  }

  return [
    {
      kicker: "H1 leadership preview",
      title: plan.name,
      bullets: [`Hero product: ${plan.heroProduct}`, `Markets: ${plan.markets.join(", ")}`, `Budget: ${plan.budget}`]
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
  return {
    heroProduct: inferHeroProduct(run.brief),
    markets: inferDelimitedList(run.brief, /markets?\s+([A-Z]{2}(?:\s*,\s*[A-Z]{2})*)/i, ["DE", "AT", "CH"]),
    locales: inferDelimitedList(run.brief, /locales?\s+([a-z]{2}-[A-Z]{2}(?:\s*,\s*[a-z]{2}-[A-Z]{2})*)/i, ["de-DE", "de-AT", "de-CH", "fr-CH"]),
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
    evidence: ["H1 Campaign Plan", "Brand Playbook", plan.audience.includes("Contractors") ? "Audience / Persona Files" : "Campaign Brief"],
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
  const match = brief.match(/\b(EUR|USD|CHF|GBP)\s*([0-9]+(?:k|K|,[0-9]{3})?)/);
  return match ? `${match[1].toUpperCase()} ${match[2].toLowerCase()}` : "EUR 50k";
}

function inferAudience(brief: string) {
  const match = brief.match(/(?:for|target)\s+([^.]+?)(?:\.| budget| markets| locales| channels| no auto-publish|$)/i);
  if (!match?.[1]) return ["Contractors", "Specifiers"];
  return [sentenceCase(match[1].replace(/\b(first|second|primary|secondary)\b/gi, "").trim())];
}

function inferHeroProduct(brief: string) {
  const lower = brief.toLowerCase();
  if (lower.includes("firestop")) return "firestop";
  if (lower.includes("measuring")) return "measuring tools";
  if (lower.includes("siw 6at-a22")) return "SIW 6AT-A22";
  const match = brief.match(/campaign for\s+(.+?)(?:\.| budget| markets| locales| target| for |$)/i);
  return match?.[1]?.trim() || "power tools";
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
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : fallback;
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
    summary: "Create a campaign, run each phase with Panda, approve gates, and preserve the trace.",
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
    nextActions: ["Run planning", "Review H1", "Approve or revise"],
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
    summary: "New campaign created. Panda is ready to structure the brief and generate the H1 plan packet.",
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
    nextActions: ["Ask Panda to create H1", "Review assumptions", "Approve or revise"],
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
  if (!compact) return "Untitled Agentic E2E campaign";
  const product = compact.match(/\b(SIW|TE|NURON|BX|PMD|HIT|EXO)[A-Z0-9 -]*/i)?.[0];
  const market = compact.match(/\b(DACH|DE|AT|CH|EU|global|APAC|North America)\b/i)?.[0];
  const prefix = market ? `${market.toUpperCase()} campaign` : "New campaign";
  return product ? `${prefix} · ${product.trim()}` : `${prefix} · ${compact.slice(0, 48)}`;
}
