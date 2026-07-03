import type { CampaignArchetype } from "../types";

const paidMediaLaunch: CampaignArchetype = {
  id: "paid-media-launch",
  version: "1.4.0",
  label: "Paid-Media Launch",
  campaign_type: "paid_media",
  description: "Single-market paid search + social launch with localization, QA, roll-out, and insights.",
  mandatory_gates: ["H1", "H2", "H3", "H4"],
  default_skill_scope: { brand: "global", market: "EU" },
  sla_per_gate_hours: { H1: 24, H2: 18, H3: 8, H4: 48 },
  adaptation_slots: [
    { id: "target_locales", type: "string_array", label: "Target locales", required: true, default: ["de-DE"] },
    { id: "segments", type: "string_array", label: "Audience segments", required: true, default: ["contractor"] },
    {
      id: "variants_per_segment", type: "integer", label: "Variants per segment", required: true,
      default: 2, constraints: { min: 1, max: 5 },
    },
    {
      id: "channels", type: "channels", label: "Channels", required: true,
      default: ["linkedin", "google", "meta"],
      constraints: { enum: ["linkedin", "google", "meta", "email", "hol"] },
    },
  ],
  steps: [
    { id: "brief", kind: "agent", label: "Brief", depends_on: [], task_type: "brief_intake", cardinality: "exactly_one" },
    { id: "h1", kind: "gate", label: "H1 — Brief Approval", gate: "H1", depends_on: ["brief"], task_type: "brief_approval", cardinality: "exactly_one" },
    { id: "strategy", kind: "agent", label: "Strategy Plan", depends_on: ["h1"], task_type: "campaign_plan", cardinality: "exactly_one" },
    { id: "content", kind: "agent", label: "Content Gen", depends_on: ["strategy"], task_type: "create_ad_set", cardinality: "exactly_one" },
    { id: "qa", kind: "tool", label: "QA Check", depends_on: ["content"], task_type: "voice_fit_review", cardinality: "exactly_one" },
    { id: "h2", kind: "gate", label: "H2 — Content Review", gate: "H2", depends_on: ["qa"], task_type: "content_review", cardinality: "exactly_one" },
    { id: "rollout", kind: "tool", label: "Roll-out", depends_on: ["h2"], task_type: "rollout_sequence", cardinality: "exactly_one" },
    { id: "h3", kind: "gate", label: "H3 — Publish Gate", gate: "H3", depends_on: ["rollout"], task_type: "publish_approval", cardinality: "exactly_one" },
    { id: "learn", kind: "agent", label: "Learn & Improve", depends_on: ["h3"], task_type: "insights", cardinality: "exactly_one" },
    { id: "h4", kind: "gate", label: "H4 — Insights & Skill Promotion", gate: "H4", depends_on: ["learn"], task_type: "skill_promotion", cardinality: "exactly_one" },
  ],
};

const stub = (id: string, label: string, campaign_type: string, description: string): CampaignArchetype => ({
  id, version: "0.1.0", label, campaign_type, description,
  mandatory_gates: ["H1", "H2", "H3", "H4"],
  default_skill_scope: { brand: "global" },
  sla_per_gate_hours: { H1: 24, H2: 24, H3: 12, H4: 72 },
  adaptation_slots: [
    { id: "target_locales", type: "string_array", label: "Target locales", required: true, default: ["de-DE"] },
    { id: "channels", type: "channels", label: "Channels", required: true, default: ["linkedin"], constraints: { enum: ["linkedin", "google", "meta", "email", "hol"] } },
  ],
  steps: paidMediaLaunch.steps, // stubs reuse the canonical shape; lighter slot set above
});

export const ARCHETYPES: CampaignArchetype[] = [
  paidMediaLaunch,
  stub("product-launch", "Product Launch", "product_launch", "New-product launch across paid + owned channels."),
  stub("regional-rollout", "Regional Roll-out", "regional_rollout", "Multi-market roll-out of an existing campaign."),
  stub("content-update", "Content Update", "content_update", "Refresh of existing creative/copy without a new media plan."),
];

export function getArchetype(id: string, version?: string): CampaignArchetype | undefined {
  const matches = ARCHETYPES.filter((a) => a.id === id);
  if (matches.length === 0) return undefined;
  if (version) return matches.find((a) => a.version === version);
  // default to highest semver
  return matches.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }))[0];
}
