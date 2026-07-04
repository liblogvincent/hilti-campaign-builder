import { useLuban } from "@/store/luban";
import { Brain, Wrench, Diamond, Layers, BookOpen, Cable, BarChart3, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BriefEntry } from "@/components/brief/BriefEntry";
import { getArchetype } from "@/lib/archetypes";

export function HomePanel() {
  const camp = useLuban((s) => s.getActive());
  const done = camp.nodes.filter((n) => n.status === "done").length;
  const total = camp.nodes.length;

  const archetypeLabel = camp.archetype
    ? getArchetype(camp.archetype.id, camp.archetype.version)?.label ?? camp.archetype.id
    : null;
  const adaptationCount = Object.keys(camp.adaptation_params ?? {}).length;

  return (
    <div className="p-5 space-y-5">
      <BriefEntry />

      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Active campaign</div>
        <div className="text-sm font-semibold">{camp.name}</div>
        {archetypeLabel && camp.archetype ? (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            <Badge variant="secondary" className="text-[10px] font-mono">
              Follows {archetypeLabel} v{camp.archetype.version}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">
              {adaptationCount} adaptation{adaptationCount === 1 ? "" : "s"}
            </Badge>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground mt-1 italic">No archetype yet</div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs text-muted-foreground">Progress</div>
          <div className="text-xs font-mono">{done}/{total}</div>
        </div>
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(done / total) * 100}%` }} />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <Stat label="Hours returned" value="445" />
          <Stat label="Standards active" value="4" />
          <Stat label="Checks automated" value="7" />
          <Stat label="First-pass rate" value="100%" />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background p-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Five Planes</div>
        <div className="space-y-1.5 text-xs">
          <Plane icon={Diamond} color="#D2051E" label="Control — gates & DAG" />
          <Plane icon={Brain} color="#F4D09B" label="Execution — agents" />
          <Plane icon={Wrench} color="#9CA3AF" label="Execution — det. tools" />
          <Plane icon={Cable} color="#60A5FA" label="Integration — MCP" />
          <Plane icon={BookOpen} color="#A78BFA" label="Knowledge — skills registry" />
          <Plane icon={BarChart3} color="#4ADE80" label="Observability — trace & eval" />
        </div>
      </div>

      <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-xs">
        <div className="text-accent font-semibold mb-1 flex items-center gap-1"><Layers className="w-3 h-3" /> Tip</div>
        Click any node to open its TaskResult. Open the Trace tab on the campaign page for the immutable audit log.
      </div>

      <div className="rounded-lg border border-border bg-background p-4 text-xs space-y-2">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Version 2 — archetype revival</div>
        <p className="text-foreground/80">
          This build revives Luban as a <span className="font-semibold">live-agent prototype</span> on a
          versioned <span className="font-semibold">Campaign Archetype</span> model — a live agent selects
          and adapts a reusable workflow shape for each campaign.
        </p>
        <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
          <li>Enter a brief — a live agent picks an archetype and adapts it into a signed plan.</li>
          <li>Review the <span className="font-mono">adapted plan</span> at H1: deviations and proposed extras are flagged.</li>
          <li>Recognizable, reusable shapes — “Follows Paid-Media Launch v1.4 · N adaptations”.</li>
          <li>Live via 580ai (Claude Opus 4.8), with a fixture fallback for key-less demos.</li>
        </ul>
        <a
          href="https://hilti-campaign-builder.vercel.app/"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 mt-1 text-primary hover:underline font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Go back to the old version (v1)
        </a>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function Plane({ icon: Icon, label, color }: { icon: any; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
