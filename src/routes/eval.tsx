import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  compoundingSeries,
  painAreaRollup,
  skillImpactSeries,
  TOTAL_BASELINE_HOURS,
} from "@/fixtures";
import { useLuban } from "@/store/luban";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
  BarChart,
  LabelList,
} from "recharts";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/eval")({
  component: EvalPage,
});

const PAIN_COLORS = {
  contentCreation: "#D2051E",
  paidMedia: "#F59E0B",
  utmQa: "#60A5FA",
  planningOther: "#6B7280",
};

function EvalPage() {
  const proposals = useLuban((s) => s.proposals);
  const promoted = proposals.filter((p) => p.status === "Promoted");
  const [costOpen, setCostOpen] = useState(false);

  const totalHours = compoundingSeries.reduce((a, p) => a + p.hoursReturned, 0);

  return (
    <div className="p-8 overflow-y-auto">
      {/* A — Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Each campaign returns more time to the team</h1>
        <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
          <span>
            Skills compound. Rework disappears. Hours flow back to strategy. Deloitte baseline:{" "}
            ~{TOTAL_BASELINE_HOURS.toLocaleString()} h/y efficiency potential (AI Pre-Read, Mar 2026).
          </span>
          <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-300">
            Baseline estimate — not yet validated in pilot
          </span>
        </p>
      </div>

      {/* B — Stat row */}
      <div className="grid grid-cols-4 gap-4 mb-6 max-w-5xl">
        <StatCard
          label="Hours returned"
          value={`${totalHours.toLocaleString()} hrs`}
          detail="Across 4 campaigns. Capture rate: [TBD — pilot measurement]"
          tone="primary"
        />
        <StatCard
          label="Skills inherited"
          value="4"
          detail="Brand Voice v2, EU Compliance v1, UTM Convention v1, Contractor Patterns v2 — all applied automatically on Q4"
          tone="accent"
        />
        <StatCard
          label="First-pass rate"
          value="0% → 100%"
          detail="Q1: 3 gates sent content back for rework. Q4: zero rework — all standards compiled and enforced."
          tone="success"
        />
        <StatCard
          label="Quality"
          value="3.2 → 4.3 / 5"
          detail="Average human rating across all agent outputs. Domain experts rated each campaign."
          tone="accent"
        />
      </div>

      {promoted.length > 0 && (
        <div className="mb-6 max-w-5xl rounded-lg border border-success/40 bg-success/5 p-4 flex items-center gap-3">
          <TrendingUp className="w-4 h-4 text-success" />
          <div className="text-xs">
            <span className="font-semibold">Promoted at H4.</span>{" "}
            <span className="text-success">{promoted.map((p) => p.name).join(" + ")}</span>{" "}
            will compound into the next campaign — projected to free additional hours on Q5.
          </div>
        </div>
      )}

      {/* C — Pain-area stacked chart */}
      <div className="rounded-lg border border-border bg-card p-6 max-w-5xl">
        <h2 className="text-sm font-semibold mb-1">Where the hours came from — by Deloitte pain area</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Stacked bars per campaign. Each segment maps to a Deloitte pain area baseline.
        </p>
        <div className="h-[340px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={painAreaRollup} margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#2E2E2E" strokeDasharray="3 3" />
              <XAxis dataKey="campaign" stroke="#9E9E9E" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9E9E9E" tick={{ fontSize: 11 }} label={{ value: "Hours returned", angle: -90, position: "insideLeft", fill: "#9E9E9E", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1A1A1A", border: "1px solid #2E2E2E", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number, name: string) => [`${v} hrs`, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="contentCreation" name="Content Creation (baseline 1,140h/y)" stackId="a" fill={PAIN_COLORS.contentCreation} />
              <Bar dataKey="paidMedia" name="Paid Media (baseline 180h/y)" stackId="a" fill={PAIN_COLORS.paidMedia} />
              <Bar dataKey="utmQa" name="UTM & QA (baseline 120h/y)" stackId="a" fill={PAIN_COLORS.utmQa} />
              <Bar dataKey="planningOther" name="Planning & Other (baseline 345h/y)" stackId="a" fill={PAIN_COLORS.planningOther} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
          Deloitte baseline: ~1,785 h/y total (1,140 content + 180 paid media + 120 UTM/QA + 345 planning).
          Capture rate parameterized — not claiming 100% of baseline.
        </p>
      </div>

      {/* D — Compounding trend */}
      <div className="mt-6 rounded-lg border border-border bg-card p-6 max-w-5xl">
        <h2 className="text-sm font-semibold mb-1">As skills accumulate, hours rise and rework falls</h2>
        <p className="text-xs text-muted-foreground mb-4">
          Bars = hours returned per campaign. Line = skills reused — the compounding lever.
        </p>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={compoundingSeries} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid stroke="#2E2E2E" strokeDasharray="3 3" />
              <XAxis dataKey="campaign" stroke="#9E9E9E" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="left" stroke="#9E9E9E" tick={{ fontSize: 11 }} label={{ value: "Hours returned", angle: -90, position: "insideLeft", fill: "#9E9E9E", fontSize: 11 }} />
              <YAxis yAxisId="right" orientation="right" stroke="#9E9E9E" tick={{ fontSize: 11 }} label={{ value: "Skills reused", angle: 90, position: "insideRight", fill: "#9E9E9E", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1A1A1A", border: "1px solid #2E2E2E", borderRadius: 8, fontSize: 12 }}
                formatter={(v: number | string, name: string) => [v, name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="left" dataKey="hoursReturned" name="Hours returned" fill="#D2051E" radius={[6, 6, 0, 0]}>
                <LabelList
                  dataKey="repairLoops"
                  position="top"
                  fill="#9E9E9E"
                  fontSize={10}
                  formatter={(value: unknown) => {
                    const n = Number(value);
                    return n > 0 ? `${n} repair loops` : "0 repair loops · 100% first-pass";
                  }}
                />
              </Bar>
              <Line yAxisId="right" type="monotone" dataKey="skillsReused" name="Skills reused" stroke="#F4D09B" strokeWidth={2.5} dot={{ r: 4, fill: "#F4D09B" }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
          Q1: 3 repair loops, content bounced twice. Q4: 0 repair loops — all 4 standards inherited from prior campaigns compiled and enforced.
        </p>
      </div>

      {/* F — Skill impact */}
      <div className="mt-6 max-w-5xl rounded-lg border border-border bg-card p-6">
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

      {/* G — What the curve says */}
      <div className="mt-6 max-w-5xl rounded-lg border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-2">What the curve says</h3>
        <p className="text-xs text-foreground/80 leading-relaxed">
          The team didn't get cheaper. They got 1,600 hours back. That's a full-time strategist for a year,
          redirected from Excel and manual QA to creative direction and market expansion. Over 4 campaigns,
          the skill library grew from 1 to 4 reusable artifacts. Two were proposed by the AI itself, reviewed
          and promoted by the team at H4. The first campaign had 3 repair loops and a 25% first-pass rate.
          The fourth had zero rework — every standard from prior campaigns was compiled, enforced, and passed
          on the first attempt.
        </p>
      </div>

      {/* E — Cost footnote (demoted, collapsible) */}
      <div className="mt-6 max-w-5xl rounded-lg border border-border bg-card">
        <button
          onClick={() => setCostOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-muted/30 transition-colors rounded-lg"
        >
          <span className="text-xs font-semibold text-muted-foreground">
            Cost (supporting evidence) — cost is the receipt, not the headline. Hours returned is the primary metric.
          </span>
          {costOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </button>
        {costOpen && (
          <div className="px-5 pb-5">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="text-muted-foreground text-[10px] uppercase tracking-wider">
                  <th className="text-left py-1">Campaign</th>
                  <th className="text-right py-1">Cost (USD)</th>
                  <th className="text-right py-1">Hours returned</th>
                  <th className="text-right py-1">Cost / hr saved</th>
                </tr>
              </thead>
              <tbody>
                {compoundingSeries.map((p) => (
                  <tr key={p.campaign} className="border-t border-border">
                    <td className="py-1.5">{p.campaign}</td>
                    <td className="text-right">${p.costUsd.toFixed(2)}</td>
                    <td className="text-right">{p.hoursReturned}</td>
                    <td className="text-right">${(p.costUsd / p.hoursReturned).toFixed(2)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border font-semibold">
                  <td className="py-1.5">Total</td>
                  <td className="text-right">
                    ${compoundingSeries.reduce((a, p) => a + p.costUsd, 0).toFixed(2)}
                  </td>
                  <td className="text-right">{totalHours}</td>
                  <td className="text-right text-primary">
                    ${(compoundingSeries.reduce((a, p) => a + p.costUsd, 0) / totalHours).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "primary" | "accent" | "success";
}) {
  const color = tone === "primary" ? "text-primary" : tone === "accent" ? "text-accent" : "text-success";
  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-2 ${color}`}>{value}</div>
      <div className="text-[11px] text-muted-foreground mt-2 leading-snug">{detail}</div>
    </div>
  );
}
