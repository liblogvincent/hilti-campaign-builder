import { createFileRoute, Link } from "@tanstack/react-router";
import { useLuban } from "@/store/luban";
import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";

export const Route = createFileRoute("/campaigns")({
  component: CampaignsPage,
});

const STATUS_COLOR: Record<string, string> = {
  Published: "bg-success/15 text-success",
  "In Progress": "bg-primary/15 text-primary",
  "Awaiting Review": "bg-warning/15 text-warning",
  Planned: "bg-muted text-muted-foreground",
};

function CampaignsPage() {
  const campaigns = useLuban((s) => s.campaigns);
  return (
    <div className="p-8 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Campaigns</h1>
        <p className="text-sm text-muted-foreground mt-1">All campaigns, oldest to newest. Skills compound across runs.</p>
      </div>
      <div className="grid gap-4 max-w-4xl">
        {campaigns.map((c) => {
          const seg = c.name.split("—")[1]?.trim() ?? c.market;
          const banner =
            c.id === "camp_04"
              ? { tone: "primary" as const, text: "445 hrs returned · 4 standards inherited · 0 repair loops" }
              : c.id === "camp_03"
                ? { tone: "accent" as const, text: "440 hrs returned · 3 standards inherited · first campaign with zero repair loops" }
                : null;
          return (
            <Link
              key={c.id}
              to="/campaign/$id"
              params={{ id: c.id }}
              className="block rounded-lg border border-border bg-card p-5 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{seg} · {c.market}</div>
                </div>
                <span className={cn("shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium", STATUS_COLOR[c.status])}>
                  {c.status}
                </span>
              </div>
              <div className="mt-4 flex items-center gap-6 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Cost</div>
                  {c.projected_cost_usd ? (
                    <div className="font-mono">
                      <span className="text-foreground">${c.total_cost_usd.toFixed(2)}</span>
                      <span className="text-muted-foreground mx-1">·</span>
                      <span className="text-accent underline decoration-dashed underline-offset-2">
                        Projected ${c.projected_cost_usd.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <div className="font-mono">${c.total_cost_usd.toFixed(2)}</div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Skills reused</div>
                  <div className="font-mono">{c.skill_count}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Skill gaps</div>
                  <div className="font-mono">{c.skill_gaps}</div>
                </div>
              </div>
              {banner && (
                <div
                  className={cn(
                    "mt-4 rounded-md px-3 py-2 text-xs",
                    banner.tone === "primary" ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent",
                  )}
                >
                  {banner.text}
                </div>
              )}
            </Link>
          );
        })}
      </div>
      <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground max-w-4xl">
        <ArrowDown className="w-3 h-3" /> Newer campaigns finish faster and cheaper. See <Link to="/eval" className="text-primary hover:underline">Eval</Link> for the curve.
      </div>
    </div>
  );
}
