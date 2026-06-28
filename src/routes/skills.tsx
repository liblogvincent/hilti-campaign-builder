import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useLuban } from "@/store/luban";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Check, X as XIcon, TrendingDown, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/skills")({
  validateSearch: (s: Record<string, unknown>) => ({
    artifact: typeof s.artifact === "string" ? s.artifact : undefined,
  }),
  component: SkillsPage,
});

const TYPE_COLOR: Record<string, string> = {
  Rule: "bg-secondary text-foreground",
  Guideline: "bg-info/15 text-info",
  Playbook: "bg-purple-500/15 text-purple-300",
  Example: "bg-accent/20 text-accent",
  Fact: "bg-success/15 text-success",
};

function SkillsPage() {
  const { artifact } = useSearch({ from: "/skills" });
  const registry = useLuban((s) => s.registry);
  const proposals = useLuban((s) => s.proposals);
  const promote = useLuban((s) => s.promoteProposal);
  const reject = useLuban((s) => s.rejectProposal);

  const [tab, setTab] = useState<"approved" | "proposed">("approved");
  const [selectedId, setSelectedId] = useState<string | undefined>(artifact);
  const proposedOpen = proposals.filter((p) => p.status === "Proposed");
  const promoted = proposals.filter((p) => p.status === "Promoted");

  const totalImpact = promoted.reduce(
    (acc, p) => ({
      cost: acc.cost + p.impact.cost_delta_usd,
      qual: acc.qual + p.impact.quality_delta,
    }),
    { cost: 0, qual: 0 },
  );

  return (
    <div className="p-8 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Skills Registry</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Approved artifacts are reused automatically. AI-proposed skills are promoted at H4 and bump a version.
        </p>
      </div>

      {promoted.length > 0 && (
        <div className="mb-6 max-w-3xl rounded-lg border border-success/40 bg-success/5 p-4">
          <div className="text-[10px] uppercase tracking-widest text-success mb-2 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" /> Compounding impact applied
          </div>
          <div className="text-sm">
            Promoted {promoted.length} skill{promoted.length === 1 ? "" : "s"} this session.
          </div>
          <div className="mt-2 flex gap-4 text-xs">
            <span>
              Next-campaign cost:{" "}
              <span className="text-success font-mono">${totalImpact.cost.toFixed(2)}</span>
            </span>
            <span>
              Next-campaign quality:{" "}
              <span className="text-success font-mono">+{(totalImpact.qual * 100).toFixed(0)}%</span>
            </span>
          </div>
        </div>
      )}

      <div className="flex gap-1 border-b border-border mb-6">
        <TabButton active={tab === "approved"} onClick={() => setTab("approved")}>
          Approved ({registry.length})
        </TabButton>
        <TabButton active={tab === "proposed"} onClick={() => setTab("proposed")}>
          Proposed ({proposedOpen.length})
        </TabButton>
      </div>

      {tab === "approved" ? (
        <div className="grid gap-4 lg:grid-cols-2 max-w-5xl">
          {registry.map((a) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={cn(
                "text-left rounded-lg border bg-card p-4 transition-colors",
                selectedId === a.id ? "border-primary" : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="text-sm font-semibold">{a.name}</div>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full", TYPE_COLOR[a.type])}>{a.type}</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
                <span>{a.scope}</span>
                <span>·</span>
                <span>v{a.version}</span>
                <span>·</span>
                <span className="text-success">{a.status}</span>
              </div>
              {a.provenance === "ai_proposed" && (
                <div className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent">
                  <Sparkles className="w-2.5 h-2.5" /> AI-Promoted{a.promoted_from && ` · from ${a.promoted_from}`}
                </div>
              )}
              {selectedId === a.id && (
                <p className="mt-3 pt-3 border-t border-border text-xs text-foreground/80 leading-relaxed">{a.body}</p>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 max-w-5xl">
          {proposedOpen.length === 0 && (
            <div className="col-span-2 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              No open proposals. Run the H4 gate after a campaign to generate new ones.
            </div>
          )}
          {proposedOpen.map((p) => (
            <div key={p.id} className="rounded-lg border border-dashed border-accent/40 bg-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-semibold">Proposed: {p.name}</div>
                <span className={cn("text-[10px] px-2 py-0.5 rounded-full", TYPE_COLOR[p.type])}>{p.type}</span>
              </div>
              <div className="space-y-1 text-xs text-muted-foreground mb-3">
                <div>Confidence: <span className="text-foreground font-mono">{p.confidence}</span></div>
                <div>Derived from: <span className="text-foreground">{p.derived_from}</span></div>
                <div>Would affect: <span className="text-foreground">{p.affects}</span></div>
              </div>
              <p className="text-xs text-foreground/80 leading-relaxed mb-3">Pattern: {p.pattern}</p>
              <div className="text-[10px] text-muted-foreground mb-3 flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-success" />
                <span>
                  Projected: <span className="text-success font-mono">${p.impact.cost_delta_usd.toFixed(2)}</span> cost ·{" "}
                  <span className="text-success font-mono">+{(p.impact.quality_delta * 100).toFixed(0)}%</span> quality
                </span>
              </div>
              {p.warning && <p className="text-xs text-warning mb-3">⚠ {p.warning}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => promote(p.id)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" /> Promote
                </button>
                <button
                  onClick={() => reject(p.id)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-md border border-border hover:bg-muted inline-flex items-center justify-center gap-1"
                >
                  <XIcon className="w-3 h-3" /> Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 text-sm border-b-2 -mb-px",
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
