import { useLuban } from "@/store/luban";
import { Brain, Wrench, Diamond, Layers, BookOpen, Cable, BarChart3 } from "lucide-react";

export function HomePanel() {
  const camp = useLuban((s) => s.getActive());
  const done = camp.nodes.filter((n) => n.status === "done").length;
  const total = camp.nodes.length;
  return (
    <div className="p-5 space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Active campaign</div>
        <div className="text-sm font-semibold">{camp.name}</div>
        {camp.template_id && (
          <div className="text-[10px] font-mono text-muted-foreground mt-1">
            template: {camp.template_id}
          </div>
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
          <Stat label="Realized cost" value={`$${camp.total_cost_usd.toFixed(2)}`} />
          <Stat label="Projected" value={camp.projected_cost_usd ? `$${camp.projected_cost_usd.toFixed(2)}` : "—"} />
          <Stat label="Skills reused" value={String(camp.skill_count)} />
          <Stat label="Skill gaps" value={String(camp.skill_gaps)} />
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
