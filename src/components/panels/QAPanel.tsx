import { useState } from "react";
import type { Validation } from "@/types";
import { Link } from "@tanstack/react-router";
import { Check, AlertTriangle, X as XIcon, Wrench, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLuban } from "@/store/luban";

export function QAPanel({
  campaignId,
  validations,
}: {
  campaignId: string;
  validations: Validation[];
}) {
  const passed = validations.filter((v) => v.result === "pass").length;
  const warned = validations.filter((v) => v.result === "warn").length;
  const failed = validations.filter((v) => v.result === "fail").length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">QA results</span>
        <span className="font-mono">
          {passed}/{validations.length} pass
        </span>
        {warned > 0 && <span className="text-warning font-mono">{warned} warn</span>}
        {failed > 0 && <span className="text-destructive font-mono">{failed} fail</span>}
      </div>
      <div className="space-y-2">
        {validations.map((v) => (
          <QACard key={v.rule} v={v} campaignId={campaignId} />
        ))}
      </div>
    </div>
  );
}

function QACard({ v, campaignId }: { v: Validation; campaignId: string }) {
  const runAutoFix = useLuban((s) => s.runAutoFix);
  const [fixing, setFixing] = useState(false);

  const palette = {
    pass: { border: "border-l-success", icon: <Check className="w-4 h-4 text-success" />, tone: "text-success" },
    warn: { border: "border-l-warning", icon: <AlertTriangle className="w-4 h-4 text-warning" />, tone: "text-warning" },
    fail: { border: "border-l-destructive", icon: <XIcon className="w-4 h-4 text-destructive" />, tone: "text-destructive" },
  }[v.result];

  return (
    <div className={cn("rounded-md border border-border border-l-4 bg-background p-3 space-y-2", palette.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          {palette.icon}
          {v.rule}
        </div>
        <span className={cn("text-[10px] uppercase tracking-wider", palette.tone)}>{v.result}</span>
      </div>
      {v.detail && <p className="text-xs text-muted-foreground leading-relaxed">{v.detail}</p>}
      {v.excerpt && (
        <div className="rounded-md bg-muted px-2 py-1.5 text-xs font-mono text-foreground/90 break-words">
          “{v.excerpt}”
        </div>
      )}
      {v.variant_id && (
        <div className="text-[10px] font-mono text-muted-foreground">on {v.variant_id}</div>
      )}
      {(v.result === "warn" || v.result === "fail") && v.variant_id && (
        <div className="flex items-center gap-2 pt-1">
          <Link
            to="/content/$campaignId"
            params={{ campaignId }}
            search={{ focus: v.variant_id }}
          >
            <Button size="sm" variant="outline" className="h-7 text-xs">
              Review
            </Button>
          </Link>
          {v.result === "fail" && (
            <Button
              size="sm"
              className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={fixing}
              onClick={async () => {
                setFixing(true);
                await runAutoFix(campaignId, v.variant_id!);
                setFixing(false);
              }}
            >
              {fixing ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Fixing…
                </>
              ) : (
                <>
                  <Wrench className="w-3 h-3 mr-1" /> Fix
                </>
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
