import { useLuban } from "@/store/luban";
import { Link } from "@tanstack/react-router";
import { skillNameById } from "@/fixtures";
import { Brain, Wrench, Diamond, Check, X as XIcon, AlertTriangle, Cable, Lightbulb, ArrowRight } from "lucide-react";
import { VariantCard } from "@/components/content/VariantCard";
import { QAPanel } from "@/components/panels/QAPanel";

export function NodeDetailPanel({ nodeId }: { nodeId: string }) {
  const camp = useLuban((s) => s.getActive());
  const node = camp.nodes.find((n) => n.id === nodeId);
  if (!node) return <div className="p-5 text-muted-foreground">Node not found.</div>;

  const Icon = node.kind === "agent" ? Brain : node.kind === "tool" ? Wrench : Diamond;

  return (
    <div className="p-5 space-y-4">
      <div>
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
          <Icon className="w-3 h-3" />
          {node.kind} {node.gate && `· ${node.gate}`}
          {node.task_id && <span className="ml-auto font-mono normal-case tracking-normal">{node.task_id}</span>}
        </div>
        <h2 className="text-base font-semibold">{node.label}</h2>
        <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
          <StatusPill status={node.status} />
          {node.kind === "tool" && node.output && node.output.cost_usd === 0 && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono text-[10px]">FREE</span>
          )}
          {node.output && node.output.cost_usd > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-foreground font-mono text-[10px]">
              ${node.output.cost_usd.toFixed(2)}
            </span>
          )}
          {node.confidence !== undefined && node.kind !== "gate" && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-foreground font-mono text-[10px]">
              {Math.round(node.confidence * 100)}% conf
            </span>
          )}
          {node.duration_ms !== undefined && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono text-[10px]">
              {node.duration_ms}ms
            </span>
          )}
          {node.cost_tokens !== undefined && node.cost_tokens > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono text-[10px]">
              {node.cost_tokens.toLocaleString()} tok
            </span>
          )}
          {node.needs_human && (
            <span className="px-2 py-0.5 rounded-full bg-warning/15 text-warning text-[10px]">needs_human</span>
          )}
        </div>
      </div>

      {/* Confidence bar */}
      {node.confidence !== undefined && node.kind !== "gate" && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Confidence</div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${node.confidence * 100}%` }}
            />
          </div>
        </div>
      )}

      {node.output?.summary && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Summary</div>
          <p className="text-sm leading-relaxed text-foreground/90">{node.output.summary}</p>
        </div>
      )}

      {/* Content node: variant previews + link to workspace */}
      {node.id === "content" && (
        <ContentNodeSection campaignId={camp.id} />
      )}

      {/* Bounded decision-node */}
      {node.decision_note && (
        <div className="rounded-md border border-accent/40 bg-accent/5 p-3 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-accent flex items-center gap-1">
            <Lightbulb className="w-3 h-3" /> Bounded decision
          </div>
          <div className="text-xs"><span className="text-muted-foreground">Decided:</span> {node.decision_note.decided}</div>
          <div className="text-xs">
            <span className="text-muted-foreground">Options:</span>{" "}
            {node.decision_note.options_considered.join(" · ")}
          </div>
          <div className="text-[11px] text-foreground/80">{node.decision_note.justification}</div>
        </div>
      )}

      {/* Skills used (with versions) */}
      {node.resolved_skill_versions && node.resolved_skill_versions.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            Skills used · exact versions ({node.resolved_skill_versions.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {node.resolved_skill_versions.map((sv) => (
              <Link
                key={sv.id}
                to="/skills"
                search={{ artifact: sv.id }}
                className="px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] hover:bg-primary/20"
              >
                {skillNameById(sv.id)} <span className="opacity-60">v{sv.version}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {node.output && node.output.skills_available_not_used.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Available, not used</div>
          <div className="flex flex-wrap gap-1.5">
            {node.output.skills_available_not_used.map((id) => (
              <span key={id} className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-[11px]" title="Not needed for this step">
                {skillNameById(id)} · not needed
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Validations / QA */}
      {node.validations && node.validations.length > 0 && (
        node.id === "qa" ? (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Brand QA results</div>
            <QAPanel campaignId={camp.id} validations={node.validations} />
          </div>
        ) : (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Validations</div>
            <div className="space-y-1">
              {node.validations.map((c) => (
                <div key={c.rule} className="flex items-center justify-between rounded-md border border-border bg-background px-3 py-2 text-xs">
                  <span>{c.rule}</span>
                  <span className="flex items-center gap-1">
                    {c.result === "pass" ? (
                      <><Check className="w-3 h-3 text-success" /><span className="text-success">pass</span></>
                    ) : c.result === "warn" ? (
                      <><AlertTriangle className="w-3 h-3 text-warning" /><span className="text-warning">warn</span></>
                    ) : (
                      <><XIcon className="w-3 h-3 text-destructive" /><span className="text-destructive">fail</span></>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )
      )}

      {/* Connector calls (Roll-out) */}
      {node.connector_calls && node.connector_calls.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
            <Cable className="w-3 h-3" /> MCP connector calls ({node.connector_calls.length})
          </div>
          <div className="space-y-1">
            {node.connector_calls.map((c, i) => (
              <div key={i} className="rounded-md border border-border bg-background p-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-mono">{c.connector_id}</span>
                  <span className={c.status === "ok" ? "text-success text-[10px]" : "text-muted-foreground text-[10px]"}>
                    {c.status}
                  </span>
                </div>
                <div className="text-muted-foreground mt-0.5">{c.action} · {c.target}</div>
                {c.timestamp && <div className="text-[9px] font-mono text-muted-foreground mt-0.5">{new Date(c.timestamp).toLocaleTimeString()}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gate decision (read-only fallback when gate is rendered via node tab) */}
      {node.kind === "gate" && node.decision && (
        <div className="rounded-md border border-border bg-background p-3 text-xs space-y-1">
          <div><span className="text-muted-foreground">Verdict:</span> <span className="font-semibold capitalize">{node.decision.verdict.replace("_", " ")}</span></div>
          <div><span className="text-muted-foreground">Reviewer:</span> {node.decision.reviewer}</div>
          <div><span className="text-muted-foreground">Note:</span> {node.decision.note}</div>
          {node.decision.decided_at && <div className="text-muted-foreground">{new Date(node.decision.decided_at).toLocaleString()}</div>}
        </div>
      )}

      {node.kind === "tool" && node.status === "waiting" && !node.connector_calls && (
        <div className="text-xs text-muted-foreground italic">Waiting on upstream approval.</div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    done: "bg-success/15 text-success",
    running: "bg-primary/15 text-primary pulse-red",
    waiting: "bg-muted text-muted-foreground",
    blocked: "bg-warning/15 text-warning",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${map[status] ?? ""}`}>
      {status}
    </span>
  );
}

function ContentNodeSection({ campaignId }: { campaignId: string }) {
  const bundle = useLuban((s) => s.contentBundles[campaignId]);
  if (!bundle) return null;
  const variants = bundle.source.variants.slice(0, 3);
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Content variants ({bundle.source.totalVariants})
        </div>
        <Link
          to="/content/$campaignId"
          params={{ campaignId }}
          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
        >
          View full workspace <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="space-y-2">
        {variants.map((v) => (
          <VariantCard key={v.id} campaignId={campaignId} variant={v} readOnly />
        ))}
      </div>
    </div>
  );
}
