import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { ArchetypeSelectOutput } from "@/lib/agentSchemas";
import { ARCHETYPES, getArchetype } from "@/lib/archetypes";
import { useLuban } from "@/store/luban";

/**
 * Renders the archetype-selection agent message: the chosen archetype (label +
 * version), the full DecisionRationale, and a "Use a different archetype"
 * dropdown that forces an override and re-triggers planning.
 *
 * Override re-trigger (per Task 11 resolution 2):
 *   1. write the override into store.archetypeOverrides[activeCampaignId]
 *   2. find the last user-role message text in store.chat
 *   3. if present, call runBriefFlow(text) — runBriefFlow honors the override
 *      and re-emits an archetype_pick + adapted plan. If absent, just leave the
 *      override set; the next brief submit will honor it.
 */
export function ArchetypeSelectCard({ pick }: { pick: ArchetypeSelectOutput }) {
  const runBriefFlow = useLuban((s) => s.runBriefFlow);
  const [busy, setBusy] = useState(false);

  const archetype = getArchetype(pick.archetype_id, pick.archetype_version);
  const label = archetype?.label ?? pick.archetype_id;
  const r = pick.selection_rationale;
  const confPct = Math.round((r?.confidence ?? 0) * 100);

  const onOverride = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    if (!id || id === pick.archetype_id) return;
    const cid = useLuban.getState().activeCampaignId;
    useLuban.setState({
      archetypeOverrides: { ...useLuban.getState().archetypeOverrides, [cid]: id },
    });
    // Re-trigger planning with the last user brief, if any.
    const lastUser = [...useLuban.getState().chat]
      .reverse()
      .find((m) => m.role === "user");
    if (!lastUser?.text) return; // override is set; next brief submit honors it.
    setBusy(true);
    try {
      await runBriefFlow(lastUser.text);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2.5 text-xs">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 shrink-0 rounded-md bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Selected archetype</div>
          <div className="text-sm font-semibold truncate">
            {label} <span className="font-mono text-muted-foreground">v{pick.archetype_version}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Confidence</div>
          <div className="text-sm font-mono">{confPct}%</div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-background p-2.5 space-y-1.5">
        {r?.decided && (
          <div>
            <span className="text-muted-foreground">Decision: </span>
            <span>{r.decided}</span>
          </div>
        )}
        {r?.why && r.why.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Why</div>
            <ul className="list-disc pl-4 space-y-0.5">
              {r.why.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        {r?.alternatives && r.alternatives.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
              Alternatives considered
            </div>
            <ul className="space-y-0.5">
              {r.alternatives.map((a, i) => (
                <li key={i}>
                  <span className="font-mono">{a.option}</span>
                  <span className="text-muted-foreground"> — {a.rejected_reason}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {r?.knowledge_cited && r.knowledge_cited.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Knowledge cited</div>
            <div className="flex flex-wrap gap-1">
              {r.knowledge_cited.map((k) => (
                <span
                  key={k}
                  className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono"
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <label className="block space-y-1">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Use a different archetype
        </div>
        <div className="relative">
          <select
            disabled={busy}
            onChange={(e) => void onOverride(e)}
            defaultValue=""
            className="w-full h-9 pl-2 pr-7 bg-background border border-border rounded-md text-xs appearance-none disabled:opacity-60 cursor-pointer"
          >
            <option value="" disabled>
              Choose…
            </option>
            {ARCHETYPES.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} ({a.id} v{a.version})
              </option>
            ))}
          </select>
          {busy && (
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          )}
        </div>
      </label>
      {busy && (
        <div className="text-[10px] text-muted-foreground">Re-running planning with override…</div>
      )}
    </div>
  );
}
