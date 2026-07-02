import { useMemo } from "react";
import { useLuban } from "@/store/luban";
import type { RunNode } from "@/types";
import { Brain, Wrench, Diamond, Check, Loader2, Circle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

function layerize(nodes: RunNode[]): RunNode[][] {
  const layerOf: Record<string, number> = {};
  const get = (id: string): number => {
    if (layerOf[id] !== undefined) return layerOf[id];
    const n = nodes.find((x) => x.id === id)!;
    const l = n.depends_on.length === 0 ? 0 : Math.max(...n.depends_on.map(get)) + 1;
    layerOf[id] = l;
    return l;
  };
  nodes.forEach((n) => get(n.id));
  const layers: RunNode[][] = [];
  nodes.forEach((n) => {
    (layers[layerOf[n.id]] ||= []).push(n);
  });
  return layers;
}

const GATE_TAB_LABEL: Record<string, { id: string; label: string }> = {
  h1: { id: "h1", label: "H1 — Brief Approval" },
  h2: { id: "h2", label: "H2 — Content Review" },
  h3: { id: "h3", label: "H3 — Publish Gate" },
  h4: { id: "h4", label: "H4 — Insights & Promotion" },
};

export function WorkflowGraph({ campaignId }: { campaignId: string }) {
  const camp = useLuban((s) => s.getCampaign(campaignId)!);
  const openTab = useLuban((s) => s.openTab);

  const layers = useMemo(() => layerize(camp.nodes), [camp.nodes]);

  if (camp.nodes.length === 0) {
    return (
      <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
        Published campaign — execution graph not retained.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-stretch gap-4 min-w-max p-4">
        {layers.map((layer, li) => (
          <div key={li} className="flex flex-col gap-3 justify-center">
            {layer.map((n) => (
              <NodeCard
                key={n.id}
                node={n}
                onClick={() => {
                  if (n.kind === "gate" && !n.decision && GATE_TAB_LABEL[n.id]) {
                    openTab({ ...GATE_TAB_LABEL[n.id], kind: "gate" });
                  } else {
                    openTab({ id: n.id, label: n.label, kind: "node" });
                  }
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function planeAccent(n: RunNode): string {
  if (n.kind === "gate") return "border-l-primary"; // Control
  if (n.kind === "agent") return "border-l-accent";  // Execution agent
  if (n.connector_calls) return "border-l-info";     // Integration
  return "border-l-muted-foreground";                // Deterministic tool
}

function NodeCard({ node, onClick }: { node: RunNode; onClick: () => void }) {
  const Icon = node.kind === "agent" ? Brain : node.kind === "tool" ? Wrench : Diamond;
  const isGate = node.kind === "gate";

  const statusColor = {
    done: "border-success/50 bg-success/5",
    running: "border-primary bg-primary/10 pulse-red",
    waiting: "border-border bg-card",
    blocked: "border-warning bg-warning/5",
  }[node.status];

  const StatusIcon = {
    done: <Check className="w-3 h-3 text-success" />,
    running: <Loader2 className="w-3 h-3 text-primary animate-spin" />,
    waiting: <Circle className="w-3 h-3 text-muted-foreground" />,
    blocked: <AlertTriangle className="w-3 h-3 text-warning" />,
  }[node.status];

  const rejected = isGate && node.decision?.verdict === "rejected";

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative text-left w-[200px] rounded-lg border-2 border-l-4 px-3 py-2.5 transition-all hover:scale-[1.02] hover:border-primary/60",
        statusColor,
        planeAccent(node),
        isGate && "rounded-2xl",
      )}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-3.5 h-3.5", isGate ? "text-primary" : node.kind === "agent" ? "text-accent" : "text-muted-foreground")} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {node.kind}{node.gate ? ` · ${node.gate}` : ""}
        </span>
        <span className="ml-auto">{rejected ? <span className="text-destructive font-bold">✕</span> : StatusIcon}</span>
      </div>
      <div className="text-sm font-medium leading-tight">{node.label}</div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-mono flex-wrap">
        {node.kind === "tool" && (!node.output || node.output.cost_usd === 0) && (
          <span className="text-muted-foreground">FREE</span>
        )}
        {node.output && node.output.cost_usd > 0 && (
          <span className="text-muted-foreground">${node.output.cost_usd.toFixed(2)}</span>
        )}
        {node.resolved_skill_versions && node.resolved_skill_versions.length > 0 && (
          <span className="text-primary">· {node.resolved_skill_versions.length} skill{node.resolved_skill_versions.length > 1 ? "s" : ""}</span>
        )}
        {node.connector_calls && (
          <span className="text-info">· {node.connector_calls.length} connectors</span>
        )}
      </div>
    </button>
  );
}
