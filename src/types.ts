export type GateId = "H1" | "H2" | "H3" | "H4";
export type NodeStatus = "done" | "running" | "waiting" | "blocked";
export type NodeKind = "agent" | "tool" | "gate";
export type GateDecisionVerdict = "approved" | "changes_requested" | "rejected";
export type Plane = "control" | "execution" | "integration" | "knowledge" | "observability";

export interface RegistryArtifact {
  id: string;
  name: string;
  type: "Rule" | "Guideline" | "Playbook" | "Example" | "Fact";
  version: number;
  scope: "Global" | "Channel" | "Market" | "Campaign";
  status: "Draft" | "Proposed" | "Approved" | "Deprecated";
  body: string;
  provenance?: "human_authored" | "ai_proposed" | "synced";
  promoted_from?: string;
}

export interface SkillProposal {
  id: string;
  name: string;
  type: RegistryArtifact["type"];
  scope: RegistryArtifact["scope"];
  confidence: number;
  derived_from: string;
  affects: string;
  pattern: string;
  body: string;
  warning?: string;
  /** Projected impact on next comparable campaign. */
  impact: { cost_delta_usd: number; quality_delta: number };
  status: "Proposed" | "Promoted" | "Rejected";
}

export interface Validation {
  rule: string;
  result: "pass" | "warn" | "fail";
  excerpt?: string;
  variant_id?: string;
  detail?: string;
}

export type AdChannel = "linkedin" | "google" | "meta" | "email" | "hol";

export interface AdVariant {
  id: string;
  channel: AdChannel;
  segment: string;
  headline: string;
  bodyCopy: string;
  cta: string;
  utmParams: Record<string, string>;
  imagePlaceholder?: string;
  characterCounts: { headline: number; body: number; cta: number };
}

export interface ContentPayload {
  variants: AdVariant[];
  briefId: string;
  strategyRef: string;
  totalVariants: number;
  channels: string[];
}

export interface LocalizedContent {
  locale: string;
  label: string;
  variants: AdVariant[];
  translationStatus: "pending" | "in_progress" | "complete" | "needs_review";
  translatorNotes?: string;
}

export interface ContentBundle {
  source: ContentPayload;
  localizations: LocalizedContent[];
}

export interface ConnectorCall {
  connector_id: string;
  action: "read" | "write" | "search" | "publish";
  target: string;
  status: "ok" | "pending" | "error";
  timestamp: string;
}

export interface DecisionNote {
  decided: string;
  options_considered: string[];
  justification: string;
}

export interface HarnessOutput {
  output_ref: string;
  summary: string;
  cost_usd: number;
  resolved_skills: string[];
  skills_available_not_used: string[];
  payload: unknown;
}

export interface GateDecision {
  gate: GateId;
  verdict: GateDecisionVerdict;
  reviewer: string;
  note: string;
  decided_at: string | null;
  signature?: string | null;
  signature_kind?: "drawn" | "typed";
  /** For H4: which proposals were promoted vs rejected. */
  proposal_actions?: { proposal_id: string; action: "promote" | "reject" }[];
}

export interface RunNode {
  id: string;
  label: string;
  kind: NodeKind;
  gate?: GateId;
  status: NodeStatus;
  depends_on: string[];
  output?: HarnessOutput | null;
  decision?: GateDecision | null;
  // TaskResult contract extras
  task_id?: string;
  confidence?: number;
  validations?: Validation[];
  cost_tokens?: number;
  duration_ms?: number;
  needs_human?: boolean;
  decision_note?: DecisionNote;
  /** For Roll-out: the deterministic connector calls executed. */
  connector_calls?: ConnectorCall[];
  /** Resolved skill versions for audit. */
  resolved_skill_versions?: { id: string; version: number }[];
  /** For content nodes: structured content payload + localizations. */
  content_bundle?: ContentBundle;
}

export interface CampaignRun {
  id: string;
  name: string;
  market: string;
  status: "Planned" | "In Progress" | "Awaiting Review" | "Published";
  total_cost_usd: number;
  projected_cost_usd?: number;
  skill_count: number;
  skill_gaps: number;
  nodes: RunNode[];
  template_id?: string;
  template_label?: string;
  sla_per_gate_hours?: Record<string, number>;
}

export interface EvalPoint {
  campaign: string;
  order: number;
  cost: number;
  skillsReused: number;
  projected: boolean;
}

export interface CampaignTemplate {
  id: string;
  label: string;
  gates: GateId[];
  sla_per_gate_hours: Record<string, number>;
  available: boolean;
}
