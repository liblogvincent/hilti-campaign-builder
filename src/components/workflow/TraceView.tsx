import { useLuban } from "@/store/luban";
import type { RunNode } from "@/types";
import { Check, AlertTriangle, X as XIcon, Diamond, Brain, Wrench, Cable } from "lucide-react";
import { skillNameById } from "@/fixtures";

export function TraceView({ campaignId }: { campaignId: string }) {
  const camp = useLuban((s) => s.getCampaign(campaignId));
  if (!camp) return null;
  const entries = camp.nodes.filter((n) => n.status === "done" || n.decision);

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Audit Trace</div>
        <div className="text-xs text-muted-foreground mt-0.5">
          Immutable. Every step, every gate decision, every skill version consumed.
        </div>
      </div>
      <ol className="divide-y divide-border">
        {entries.length === 0 && (
          <li className="px-4 py-6 text-center text-xs text-muted-foreground">No completed steps yet.</li>
        )}
        {entries.map((n) => (
          <TraceEntry key={n.id} node={n} />
        ))}
      </ol>
    </div>
  );
}

function TraceEntry({ node }: { node: RunNode }) {
  const Icon = node.kind === "agent" ? Brain : node.kind === "tool" ? Wrench : Diamond;
  return (
    <li className="px-4 py-3 text-sm">
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              {node.kind}{node.gate ? ` · ${node.gate}` : ""}
            </span>
            <span className="font-medium">{node.label}</span>
            {node.task_id && <span className="ml-auto text-[10px] font-mono text-muted-foreground">{node.task_id}</span>}
          </div>

          {node.decision ? (
            <div className="mt-1.5 text-xs space-y-0.5">
              <div className="flex items-center gap-2">
                {node.decision.verdict === "approved" ? (
                  <Check className="w-3 h-3 text-success" />
                ) : node.decision.verdict === "rejected" ? (
                  <XIcon className="w-3 h-3 text-destructive" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-warning" />
                )}
                <span className="capitalize">{node.decision.verdict.replace("_", " ")}</span>
                <span className="text-muted-foreground">by {node.decision.reviewer}</span>
                {node.decision.decided_at && (
                  <span className="ml-auto text-[10px] font-mono text-muted-foreground">
                    {new Date(node.decision.decided_at).toLocaleTimeString()}
                  </span>
                )}
              </div>
              <div className="text-muted-foreground text-xs">{node.decision.note}</div>
              {node.decision.signature && (
                <div className="pt-1">
                  {node.decision.signature_kind === "typed" ? (
                    <span
                      className="text-base italic"
                      style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}
                    >
                      {node.decision.signature}
                    </span>
                  ) : (
                    <img src={node.decision.signature} alt="sig" className="h-8 w-auto inline-block" />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">{node.output?.summary}</div>
          )}

          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] font-mono text-muted-foreground">
            {node.output && node.output.cost_usd > 0 && <span>${node.output.cost_usd.toFixed(2)}</span>}
            {node.duration_ms !== undefined && <span>{node.duration_ms}ms</span>}
            {node.cost_tokens !== undefined && node.cost_tokens > 0 && <span>{node.cost_tokens.toLocaleString()} tok</span>}
            {node.confidence !== undefined && <span>conf {Math.round(node.confidence * 100)}%</span>}
          </div>

          {node.resolved_skill_versions && node.resolved_skill_versions.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {node.resolved_skill_versions.map((sv) => (
                <span key={sv.id} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {skillNameById(sv.id)} v{sv.version}
                </span>
              ))}
            </div>
          )}

          {node.connector_calls && node.connector_calls.length > 0 && (
            <div className="mt-1.5 space-y-0.5">
              {node.connector_calls.map((c, i) => (
                <div key={i} className="text-[10px] flex items-center gap-1.5 text-muted-foreground">
                  <Cable className="w-2.5 h-2.5" />
                  <span className="font-mono">{c.connector_id}</span>
                  <span>· {c.action}</span>
                  <span className="truncate">{c.target}</span>
                  <span className={c.status === "ok" ? "text-success ml-auto" : "ml-auto"}>{c.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
