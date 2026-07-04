import { useLuban } from "@/store/luban";
import { getArchetype } from "@/lib/archetypes";

/**
 * H1 review aid: shows how the agent's adapted plan relates to the selected
 * archetype's canonical shape.
 *
 * - Left column: the archetype's canonical `steps` (id + kind).
 * - Right column: the live `adaptation_params` (key/value), highlighting where
 *   a value deviates from its slot default.
 * - "Proposed extras": campaign nodes whose id is NOT in the archetype's step
 *   ids (per Task 11 resolution 1 — proposed extras are derived in the UI, not
 *   stored separately), each marked PROPOSED. Rationale text is deferred for
 *   B.1; only the PROPOSED marker is shown.
 */
export function AdaptedPlanDiff() {
  const camp = useLuban((s) => s.getActive());

  // No archetype selected (e.g. legacy/demo campaign) — nothing to diff.
  if (!camp.archetype) return null;
  const archetype = getArchetype(camp.archetype.id, camp.archetype.version);
  if (!archetype) return null;

  const archetypeStepIds = new Set(archetype.steps.map((s) => s.id));
  const extraNodes = camp.nodes.filter((n) => !archetypeStepIds.has(n.id));
  const adaptations = camp.adaptation_params ?? {};
  const fmt = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v));

  return (
    <div className="rounded-md border border-border bg-background p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Adapted plan vs archetype
        </div>
        <div className="text-[10px] font-mono text-muted-foreground">
          {archetype.label} v{archetype.version}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Canonical steps
          </div>
          <ul className="space-y-0.5 text-[11px]">
            {archetype.steps.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5">
                <span className="font-mono text-muted-foreground w-10 uppercase">{s.kind}</span>
                <span className="font-mono">{s.id}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Adaptations
          </div>
          {Object.keys(adaptations).length === 0 ? (
            <div className="text-[11px] text-muted-foreground">— none —</div>
          ) : (
            <ul className="space-y-0.5 text-[11px]">
              {archetype.adaptation_slots.map((slot) => {
                const raw = adaptations[slot.id];
                if (raw === undefined) return null;
                const deviates =
                  slot.default !== undefined &&
                  JSON.stringify(raw) !== JSON.stringify(slot.default);
                return (
                  <li key={slot.id} className="flex items-center justify-between gap-2">
                    <span className="font-mono shrink-0">{slot.id}</span>
                    <span
                      className={
                        "font-mono text-right truncate " +
                        (deviates ? "text-warning" : "text-foreground/80")
                      }
                    >
                      {fmt(raw)}
                      {deviates && (
                        <span className="text-[9px] text-muted-foreground ml-1">
                          (default {fmt(slot.default)})
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
              {/* Render any adaptation keys not covered by declared slots. */}
              {Object.keys(adaptations)
                .filter((k) => !archetype.adaptation_slots.some((s) => s.id === k))
                .map((k) => (
                  <li key={k} className="flex items-center justify-between gap-2">
                    <span className="font-mono shrink-0">{k}</span>
                    <span className="font-mono text-foreground/80 text-right truncate">{fmt(adaptations[k])}</span>
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {extraNodes.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            Proposed extras — needs your approval
          </div>
          <ul className="space-y-0.5 text-[11px]">
            {extraNodes.map((n) => (
              <li key={n.id} className="flex items-center gap-1.5">
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-warning/15 text-warning border border-warning/60">
                  PROPOSED
                </span>
                <span className="font-mono">{n.id}</span>
                <span className="text-muted-foreground">· {n.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
