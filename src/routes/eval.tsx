import { createFileRoute } from "@tanstack/react-router";
import { evalSeries, skillImpactSeries } from "@/fixtures";
import { useLuban } from "@/store/luban";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid, ResponsiveContainer, Cell,
  BarChart,
} from "recharts";
import { TrendingDown } from "lucide-react";

export const Route = createFileRoute("/eval")({
  component: EvalPage,
});

function EvalPage() {
  const proposals = useLuban((s) => s.proposals);
  const promoted = proposals.filter((p) => p.status === "Promoted");
  const reprojection = promoted.reduce((a, p) => a + p.impact.cost_delta_usd, 0);

  const adjusted = evalSeries.map((p) =>
    p.projected
      ? { ...p, cost: +(p.cost + reprojection).toFixed(2), reprojected: reprojection !== 0 }
      : { ...p, reprojected: false },
  );

  return (
    <div className="p-8 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Eval</h1>
        <p className="text-sm text-muted-foreground mt-1">
          How Luban compounds: each campaign leaves behind skills the next one reuses.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 max-w-4xl">
        <StatCard label="Cost dropped" value="44%" detail="$52 → $29" tone="primary" />
        <StatCard label="Skills reused" value="4×" detail="1 → 4" tone="accent" />
        <StatCard label="Quality improved" value="12%" detail="0.82 → 0.93" tone="success" />
      </div>

      {promoted.length > 0 && (
        <div className="mb-6 max-w-4xl rounded-lg border border-success/40 bg-success/5 p-4 flex items-center gap-3">
          <TrendingDown className="w-4 h-4 text-success" />
          <div className="text-xs">
            <span className="font-semibold">Re-projected.</span> Promoted{" "}
            <span className="text-success">
              {promoted.map((p) => p.name).join(" + ")}
            </span>{" "}
            at H4 — Q4 cost re-projected{" "}
            <span className="font-mono">${(29).toFixed(2)} → ${(29 + reprojection).toFixed(2)}</span>.
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-6 max-w-4xl">
        <h2 className="text-sm font-semibold mb-1">Compounding: cost per campaign falls as skills accumulate</h2>
        <p className="text-xs text-muted-foreground mb-4">Bar = cost (USD), line = approved skills reused per run. Q4 cost is projected.</p>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={adjusted} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#2E2E2E" strokeDasharray="3 3" />
              <XAxis dataKey="campaign" stroke="#9E9E9E" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#9E9E9E" tick={{ fontSize: 11 }} label={{ value: "Cost ($)", angle: -90, position: "insideLeft", fill: "#9E9E9E", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#9E9E9E" tick={{ fontSize: 11 }} label={{ value: "Skills", angle: 90, position: "insideRight", fill: "#9E9E9E", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1A1A1A", border: "1px solid #2E2E2E", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="cost" name="Cost ($)" radius={[6, 6, 0, 0]}>
                {adjusted.map((d, i) => (
                  <Cell key={i} fill={d.projected ? "#D2051E80" : "#D2051E"} stroke={d.projected ? "#D2051E" : undefined} strokeDasharray={d.projected ? "4 3" : undefined} />
                ))}
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="skillsReused" name="Skills reused" stroke="#F4D09B" strokeWidth={2.5} dot={{ r: 4, fill: "#F4D09B" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 max-w-4xl rounded-lg border border-border bg-card p-6">
        <h2 className="text-sm font-semibold mb-1">Skill impact tracking</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Per-skill quality score before vs after promotion. Closes the "did the promotion actually help?" loop.
        </p>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={skillImpactSeries} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#2E2E2E" strokeDasharray="3 3" />
              <XAxis dataKey="skill" stroke="#9E9E9E" tick={{ fontSize: 10 }} />
              <YAxis stroke="#9E9E9E" tick={{ fontSize: 11 }} domain={[0.5, 1]} />
              <Tooltip contentStyle={{ background: "#1A1A1A", border: "1px solid #2E2E2E", borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="before" name="Before promotion" fill="#6B7280" radius={[4, 4, 0, 0]} />
              <Bar dataKey="after" name="After promotion" fill="#4ADE80" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="mt-6 max-w-4xl rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-2">What the curve says</h3>
        <p className="text-xs text-foreground/80 leading-relaxed">
          Over 4 campaigns, cost dropped 44% ($52 → $29 projected) as the skill library grew from 1 to 4 reused artifacts.
          Each campaign leaves behind patterns the next one reuses. When a skill is promoted at H4, the projection above
          updates immediately so compounding is visible — not just narrated.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "primary" | "accent" | "success" }) {
  const color = tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-success";
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-3xl font-bold mt-2 ${color}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-1 font-mono">{detail}</div>
    </div>
  );
}
