import { z } from "zod";

const rationaleSchema = z.object({
  decided: z.string(),
  why: z.array(z.string()),
  alternatives: z.array(z.object({ option: z.string(), rejected_reason: z.string() })),
  confidence: z.number().min(0).max(1),
  knowledge_cited: z.array(z.string()),
});

export const ArchetypeSelectOutputSchema = z.object({
  archetype_id: z.string(),
  archetype_version: z.string(),
  selection_rationale: rationaleSchema,
});
export type ArchetypeSelectOutput = z.infer<typeof ArchetypeSelectOutputSchema>;

export const PlanNodeSchema = z.object({
  id: z.string(),
  kind: z.enum(["agent", "tool", "gate"]),
  label: z.string(),
  gate: z.string().optional(),
  depends_on: z.array(z.string()),
  task_type: z.string().optional(),
});
export type PlanNode = z.infer<typeof PlanNodeSchema>;

export const AdaptedPlanOutputSchema = z.object({
  archetype_id: z.string(),
  archetype_version: z.string(),
  adaptation_params: z.record(z.string(), z.unknown()),
  nodes: z.array(PlanNodeSchema),
  proposed_extras: z
    .array(z.object({
      kind: z.enum(["gate", "step"]),
      id: z.string(),
      after: z.string(),
      rationale: z.string(),
    }))
    .optional(),
  selection_rationale: rationaleSchema,
});
export type AdaptedPlanOutput = z.infer<typeof AdaptedPlanOutputSchema>;

// ── P0 agent output schemas (Track A aligned) ──

// a0 — StructuredBrief (consumed by a1, a2, H1)
export const StructuredBriefSchema = z.object({
  campaign_name: z.string(),
  objective: z.object({
    primary: z.enum(["awareness", "traffic", "engagement", "lead_generation", "conversion", "app_promotion", "other"]),
    secondary: z.array(z.enum(["awareness", "traffic", "engagement", "lead_generation", "conversion", "app_promotion", "other"])).optional(),
    kpi_targets: z.object({
      roas_target: z.number().optional(),
      conversion_target: z.number().optional(),
      cpa_max: z.object({ amount: z.number(), currency: z.string() }).optional(),
    }).optional(),
  }),
  product: z.object({
    hero_products: z.array(z.object({
      sku: z.string(),
      name: z.string(),
      category: z.string(),
    })),
    offer: z.object({ type: z.string(), description: z.string(), discount_pct: z.number().optional() }).optional(),
  }),
  audience: z.object({
    primary_segments: z.array(z.string()),
    targeting_exclusions: z.array(z.string()).optional(),
  }),
  geography: z.object({
    primary_market: z.string(),
    secondary_markets: z.array(z.string()).optional(),
    languages: z.array(z.string()),
  }),
  budget: z.object({ total: z.object({ amount: z.number(), currency: z.string() }) }),
  timeline: z.object({
    campaign_start: z.string(),
    campaign_end: z.string(),
    duration_weeks: z.number(),
    key_milestones: z.array(z.object({ date: z.string(), label: z.string() })).optional(),
  }),
  channels: z.object({ requested: z.array(z.string()), excluded: z.array(z.string()).optional() }),
  destinations: z.object({ landing_urls: z.array(z.string()) }),
  completeness: z.object({
    status: z.enum(["complete", "incomplete"]),
    missing_fields: z.array(z.string()),
    warnings: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
  decision_rationale: rationaleSchema,
});
export type StructuredBrief = z.infer<typeof StructuredBriefSchema>;

// a1 — AdvisoryContext (consumed by a2)
export const AdvisoryContextSchema = z.object({
  market_conditions: z.object({
    competitive_activity: z.enum(["low", "medium", "high"]),
    seasonal_factors: z.array(z.string()).optional(),
    pricing_pressure: z.enum(["low", "medium", "high"]).optional(),
  }),
  benchmark_kpis: z.object({
    avg_ctr: z.number().optional(),
    avg_cpm: z.object({ amount: z.number(), currency: z.string() }).optional(),
    avg_conversion_rate: z.number().optional(),
  }).optional(),
  historical_campaigns: z.array(z.object({
    campaign_id: z.string(),
    similarity_score: z.number().min(0).max(1),
    key_learnings: z.array(z.string()),
  })).optional(),
  risk_flags: z.array(z.string()).optional(),
  decision_rationale: rationaleSchema,
});
export type AdvisoryContext = z.infer<typeof AdvisoryContextSchema>;

// a2 — PaidMediaPlan (consumed by cp2, r10, r11, H1)
export const PaidMediaPlanSchema = z.object({
  channel_allocations: z.array(z.object({
    platform: z.string(),
    pct: z.number().min(0).max(100),
    budget: z.object({ amount: z.number(), currency: z.string() }),
    format: z.string().optional(),
    audience_targeting: z.string(),
  })),
  budget_pacing: z.object({
    total: z.object({ amount: z.number(), currency: z.string() }),
    weekly_breakdown: z.array(z.object({ week: z.number(), amount: z.number() })).optional(),
  }),
  kpi_targets: z.object({
    roas_target: z.number().optional(),
    cpa_ceiling: z.object({ amount: z.number(), currency: z.string() }),
    expected_impressions: z.number().optional(),
    expected_conversions: z.number().optional(),
  }),
  messaging_pillars: z.array(z.object({ pillar: z.string(), key_message: z.string() })),
  timeline_notes: z.string().optional(),
  decision_rationale: rationaleSchema,
});
export type PaidMediaPlan = z.infer<typeof PaidMediaPlanSchema>;

// c1 — AdCopySet (consumed by c2, H2)
export const AdCopySetSchema = z.object({
  variants: z.array(z.object({
    channel: z.string(),
    headline: z.string(),
    body: z.string(),
    cta: z.string(),
    segment: z.string(),
    locale: z.string(),
  })),
  tone_notes: z.string().optional(),
  decision_rationale: rationaleSchema,
});
export type AdCopySet = z.infer<typeof AdCopySetSchema>;

// c2 — ComplianceReport (consumed by H2)
export const ComplianceReportSchema = z.object({
  flags: z.array(z.object({
    rule_id: z.string(),
    severity: z.enum(["critical", "high", "medium", "low"]),
    variant_id: z.string().optional(),
    note: z.string(),
    fix_suggestion: z.string().optional(),
  })),
  overall_verdict: z.enum(["pass", "pass_with_warnings", "fail"]),
  decision_rationale: rationaleSchema,
});
export type ComplianceReport = z.infer<typeof ComplianceReportSchema>;

// r10 — UtmSet (consumed by r5, r11)
export const UtmSetSchema = z.object({
  utms: z.array(z.object({
    channel: z.string(),
    utm_source: z.string(),
    utm_medium: z.string(),
    utm_campaign: z.string(),
    utm_content: z.string().optional(),
    utm_term: z.string().optional(),
    landing_url: z.string(),
  })),
  naming_convention: z.string(),
  decision_rationale: rationaleSchema,
});
export type UtmSet = z.infer<typeof UtmSetSchema>;

// Schema registry — maps node task_type → Zod schema for generateObject
export const AGENT_SCHEMA_MAP: Record<string, z.ZodTypeAny> = {
  brief_intake: StructuredBriefSchema,
  campaign_plan: PaidMediaPlanSchema,
  create_ad_set: AdCopySetSchema,
  voice_fit_review: ComplianceReportSchema,
  localize: AdCopySetSchema, // same shape, different prompt
  utm_create_qa: UtmSetSchema,
  insights: z.object({ proposals: z.array(z.object({ name: z.string(), description: z.string() })) }),
};

export const AGENT_SCHEMA_NAMES: Record<string, string> = {
  brief_intake: "structured_brief",
  campaign_plan: "paid_media_plan",
  create_ad_set: "ad_copy_set",
  voice_fit_review: "compliance_report",
  localize: "ad_copy_set",
  utm_create_qa: "utm_set",
  insights: "insights",
};
