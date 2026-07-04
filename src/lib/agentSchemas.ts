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
