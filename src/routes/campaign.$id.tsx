import { createFileRoute, notFound } from "@tanstack/react-router";
import { useLuban } from "@/store/luban";
import { WorkflowGraph } from "@/components/workflow/WorkflowGraph";
import { TraceView } from "@/components/workflow/TraceView";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { Brain, Wrench, Diamond } from "lucide-react";

export const Route = createFileRoute("/campaign/$id")({
  component: CampaignDetail,
  notFoundComponent: () => <div className="p-10">Campaign not found.</div>,
});

const STEPS = ["Plan", "Create", "QA", "Roll-out", "Publish", "Learn", "Promote"];
const STEP_BY_NODE: Record<string, number> = {
  brief: 0, h1: 0, strategy: 0,
  content: 1, qa: 2, h2: 2,
  rollout: 3, h3: 4, learn: 5, h4: 6,
};

type View = "graph" | "table" | "trace";

function CampaignDetail() {
  const { id } = Route.useParams();
  const camp = useLuban((s) => s.getCampaign(id));
  const [view, setView] = useState<View>("graph");
  if (!camp) throw notFound();

  const lastDone = [...camp.nodes].reverse().find((n) => n.status === "done");
  const stepIdx = lastDone ? STEP_BY_NODE[lastDone.id] : 0;
  const isPublished = camp.status === "Published";

  return (
    <div className="p-8 overflow-y-auto">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Campaign</div>
          <h1 className="text-xl font-semibold">{camp.name}</h1>
          {camp.template_id && (
            <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
              <span>template: {camp.template_id}</span>
              {camp.sla_per_gate_hours && (
                <span>· SLA H1 {camp.sla_per_gate_hours.H1}h · H2 {camp.sla_per_gate_hours.H2}h · H3 {camp.sla_per_gate_hours.H3}h · H4 {camp.sla_per_gate_hours.H4}h</span>
              )}
            </div>
          )}
        </div>
        <span className={cn(
          "shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium",
          camp.status === "Published" ? "bg-success/15 text-success" :
          camp.status === "In Progress" ? "bg-primary/15 text-primary" :
          camp.status === "Awaiting Review" ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground",
        )}>
          {camp.status}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          {STEPS.map((s, i) => {
            const done = isPublished || i < stepIdx;
            const active = !isPublished && i === stepIdx;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono",
                  done ? "bg-success text-background" :
                  active ? "bg-primary text-primary-foreground pulse-red" :
                  "bg-muted text-muted-foreground border border-border",
                )}>
                  {i + 1}
                </div>
                <span className={cn("text-[10px]", active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground")}>
                  {s}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4 text-xs">
        <span className="px-2 py-1 rounded-md bg-muted font-mono">
          ${camp.total_cost_usd.toFixed(2)}
          {camp.projected_cost_usd && (
            <span className="text-muted-foreground"> · proj ${camp.projected_cost_usd.toFixed(2)}</span>
          )}
        </span>
        <span className="px-2 py-1 rounded-md bg-muted">{camp.skill_count} skills reused</span>
        <span className="px-2 py-1 rounded-md bg-muted text-muted-foreground">{camp.skill_gaps} gaps</span>
        <div className="ml-auto flex items-center gap-1">
          <TabBtn active={view === "graph"} onClick={() => setView("graph")}>Graph</TabBtn>
          <TabBtn active={view === "table"} onClick={() => setView("table")}>Table</TabBtn>
          <TabBtn active={view === "trace"} onClick={() => setView("trace")}>Trace</TabBtn>
        </div>
      </div>

      {view === "graph" && <WorkflowGraph campaignId={id} />}
      {view === "table" && <NodeTable campaignId={id} />}
      {view === "trace" && <TraceView campaignId={id} />}
    </div>
  );
}

function TabBtn({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-xs px-2 py-1 rounded-md",
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function NodeTable({ campaignId }: { campaignId: string }) {
  const camp = useLuban((s) => s.getCampaign(campaignId)!);
  const openTab = useLuban((s) => s.openTab);
  if (camp.nodes.length === 0) return <div className="text-sm text-muted-foreground">No execution graph retained.</div>;
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-2 font-medium">Step</th>
            <th className="text-left px-4 py-2 font-medium">Kind</th>
            <th className="text-left px-4 py-2 font-medium">Status</th>
            <th className="text-right px-4 py-2 font-medium">Cost</th>
          </tr>
        </thead>
        <tbody>
          {camp.nodes.map((n) => {
            const Icon = n.kind === "agent" ? Brain : n.kind === "tool" ? Wrench : Diamond;
            return (
              <tr
                key={n.id}
                onClick={() => openTab({ id: n.id, label: n.label, kind: n.kind === "gate" && !n.decision ? "gate" : "node" })}
                className="border-t border-border hover:bg-muted/30 cursor-pointer"
              >
                <td className="px-4 py-2.5">{n.label}</td>
                <td className="px-4 py-2.5 text-muted-foreground"><span className="inline-flex items-center gap-1.5"><Icon className="w-3 h-3" />{n.kind}</span></td>
                <td className="px-4 py-2.5">
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full",
                    n.status === "done" ? "bg-success/15 text-success" :
                    n.status === "running" ? "bg-primary/15 text-primary" :
                    n.status === "blocked" ? "bg-warning/15 text-warning" :
                    "bg-muted text-muted-foreground",
                  )}>
                    {n.status}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right font-mono text-xs">
                  {n.kind === "tool" ? "FREE" : n.output?.cost_usd ? `$${n.output.cost_usd.toFixed(2)}` : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
