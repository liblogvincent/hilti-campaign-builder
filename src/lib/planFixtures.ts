import type { AdaptedPlan } from "../types";
import type { ArchetypeSelectOutput } from "./agentSchemas";

export const FIXTURE_SELECT: ArchetypeSelectOutput = {
  archetype_id: "paid-media-launch",
  archetype_version: "1.4.0",
  selection_rationale: {
    decided: "Paid-Media Launch v1.4",
    why: ["Brief names paid channels and a contractor segment", "Maps to the canonical paid-media-launch shape"],
    alternatives: [
      { option: "product-launch", rejected_reason: "No new product introduced in the brief" },
      { option: "regional-rollout", rejected_reason: "Single market (EU), not a multi-market roll-out" },
    ],
    confidence: 0.9,
    knowledge_cited: ["art_b2b_linkedin_v3", "art_brandvoice_v2"],
  },
};

export const FIXTURE_PLAN: AdaptedPlan = {
  archetype: { id: "paid-media-launch", version: "1.4.0" },
  adaptation_params: {
    target_locales: ["de-DE", "de-AT", "de-CH"],
    segments: ["contractor"],
    variants_per_segment: 3,
    channels: ["linkedin", "google", "meta", "email", "hol"],
  },
  proposed_extras: [
    { kind: "gate", id: "h_legal", after: "qa", rationale: "Compliance flag: 'revolutionary' triggers a legal review before launch." },
  ],
  selection_rationale: FIXTURE_SELECT.selection_rationale,
  nodes: [
    { id: "brief", label: "Brief", kind: "agent", status: "waiting", depends_on: [] },
    { id: "h1", label: "H1 — Brief Approval", kind: "gate", gate: "H1", status: "waiting", depends_on: ["brief"], decision: null },
    { id: "strategy", label: "Strategy Plan", kind: "agent", status: "waiting", depends_on: ["h1"] },
    { id: "content", label: "Content Gen", kind: "agent", status: "waiting", depends_on: ["strategy"] },
    { id: "qa", label: "QA Check", kind: "tool", status: "waiting", depends_on: ["content"] },
    { id: "h_legal", label: "H-legal — Legal/Compliance", kind: "gate", gate: "H-legal", status: "waiting", depends_on: ["qa"], decision: null },
    { id: "h2", label: "H2 — Content Review", kind: "gate", gate: "H2", status: "waiting", depends_on: ["h_legal"], decision: null },
    { id: "rollout", label: "Roll-out", kind: "tool", status: "waiting", depends_on: ["h2"] },
    { id: "h3", label: "H3 — Publish Gate", kind: "gate", gate: "H3", status: "waiting", depends_on: ["rollout"], decision: null },
    { id: "learn", label: "Learn & Improve", kind: "agent", status: "waiting", depends_on: ["h3"] },
    { id: "h4", label: "H4 — Insights & Skill Promotion", kind: "gate", gate: "H4", status: "waiting", depends_on: ["learn"], decision: null },
  ],
};
