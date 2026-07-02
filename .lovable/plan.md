# Rebuild Eval: hours returned as the headline metric

Shift the entire app's narrative from "cost dropped 44%" to "1,600 hours returned to the team," backed by Deloitte AI Pre-Read baselines. Cost data stays in the model but is visually demoted everywhere.

## 1. Fixtures & types (`src/types.ts`, `src/fixtures.ts`)

- Add interfaces: `DeloitteBaseline`, `PainAreaRollup`, `CompoundingPoint`. Keep `EvalPoint` exported for back-compat but stop using it in the Eval page.
- In `src/fixtures.ts`, add three new exports exactly per spec: `deloitteBaselines`, `TOTAL_BASELINE_HOURS = 1785`, `painAreaRollup`, `compoundingSeries`. Keep `evalSeries` and `skillImpactSeries` (still used by `skillImpactSeries` chart, and as a safety net if other files import it).

## 2. Rewrite `src/routes/eval.tsx`

New top-to-bottom structure:

- **A. Header** — Title "Each campaign returns more time to the team", subtitle with Deloitte citation, amber humility `Badge` "Baseline estimate — not yet validated in pilot".
- **B. Stat row (4 cards)** — replace the 3 cost/skills/quality cards with: 1,600 hrs returned · Skills inherited: 4 · First-pass rate: 0% → 100% · Quality: 3.2 → 4.3. Reuse existing `StatCard` styling (extend to 4 cols).
- **C. Pain-area stacked bar chart (NEW headline chart)** — Recharts `BarChart` with 4 stacked series (Content Creation #D2051E, Paid Media amber, UTM & QA blue, Planning & Other grey) over `painAreaRollup`. Tooltip shows per-area hours + Deloitte baseline ref. Footnote under the chart with the 1,785h breakdown and the capture-rate caveat.
- **D. Compounding trend (updated `ComposedChart`)** — left bars = `hoursReturned`, right line = `skillsReused`. Cost line removed from this chart. Add `ReferenceLine`/`Label` callouts on Q1 ("3 repair loops") and Q4 ("0 repair loops · 100% first-pass"). Keep the "Re-projected" promoted-skills banner but reword it to hours-impact framing (still driven by `proposals` state).
- **E. Cost footnote (demoted)** — shadcn `Collapsible`, collapsed by default. Small table Q1 $52.00 → Q4 $31.40, plus "Cost per hour saved: $0.07". Label "Cost is the receipt, not the headline."
- **F. Skill impact chart** — keep as-is (already supports the compounding narrative).
- **G. "What the curve says" card** — replace text with the spec's hours-returned paragraph.

## 3. Label updates across the app

- **`src/lib/chatScript.ts`** — update `POST_H4_APPROVE` to the hours-framed copy.
- **`src/routes/campaigns.tsx`** — Q3 banner → "440 hrs returned · 3 standards inherited · first campaign with zero repair loops"; Q4 banner → "445 hrs returned · 4 standards inherited · 0 repair loops". (Read file first to find exact banner strings.)
- **`src/components/panels/HomePanel.tsx`** — replace the realized/projected cost stat row with 4 tiles: Hours returned 445 · Standards active 4 · Checks automated 7 · First-pass rate 100%.
- **`src/store/luban.ts` opening-sequence progress lines** — swap `[$X.XX]` suffixes for `· N standards applied · N hrs saved vs. manual` on the strategy/content/QA/rollout progress messages. (Read first to locate the exact lines.)
- **`src/routes/campaign.$id.tsx`** — light pass: if any header KPI shows cost as the headline, add an hours-returned counterpart; otherwise leave structural layout alone.
- **`src/components/shell/Sidebar.tsx`** — no text change (per spec).

## 4. Technical notes

- Recharts is already installed; no new deps.
- Use existing dark theme tokens; the only new accent is the amber humility badge — use the existing `warning`/amber Tailwind class already in the project (or `bg-amber-500/15 text-amber-300 border-amber-500/30` inline if no token exists).
- Cost fields stay in `compoundingSeries` and `campaigns[]` — only the visual treatment changes.
- All edits are presentation-layer; no store schema changes beyond chat-script copy and progress-line strings.

## Out of scope

- Recomputing cost numbers, changing gate logic, or touching content-workspace files.
- Renaming the `/eval` route or sidebar entry.
