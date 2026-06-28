## Goal

Add a complete content layer to Luban: structured content payloads, a dedicated `/content/:campaignId` workspace with editing, localization (DE / AT / CH), brand QA with real pass/warn/fail states, regenerate-with-undo, and tight integration into the existing H2 gate and node-detail panels.

## 1. Types (`src/types.ts`)

Add exactly as specified:

```ts
export interface AdVariant {
  id: string;
  channel: "linkedin" | "google" | "meta" | "email" | "hol";
  segment: string;
  headline: string;
  bodyCopy: string;
  cta: string;
  utmParams: Record<string, string>;
  imagePlaceholder?: string;
  characterCounts: { headline: number; body: number; cta: number };
}
export interface ContentPayload {
  variants: AdVariant[];
  briefId: string;
  strategyRef: string;
  totalVariants: number;
  channels: string[];
}
export interface LocalizedContent {
  locale: string;             // "de-DE" | "de-AT" | "de-CH" | "fr-FR"
  label: string;
  variants: AdVariant[];
  translationStatus: "pending" | "in_progress" | "complete" | "needs_review";
  translatorNotes?: string;
}
export interface ContentBundle {
  source: ContentPayload;
  localizations: LocalizedContent[];
}
```

Extend `RunNode` with optional `content_bundle?: ContentBundle` so a content node can carry it without abusing `output.payload`. Extend `Validation` with `excerpt?: string` and `variant_id?: string` so QA checks point at the offending copy.

## 2. Fixtures (`src/fixtures.ts`)

Build a `contentBundle` for `camp_04`:

**Source variants (7)** — brand-voice compliant except where flagged:
- `v_li_contractor`, `v_li_specifier`, `v_li_rental` — LinkedIn, 3 segments
- `v_g_contractor`, `v_g_specifier` — Google
- `v_email_contractor` — Email (subject + preheader + body in `bodyCopy`)
- `v_hol_landing` — HOL landing summary (hero headline + value props)

Real Hilti-tone copy. UTMs follow `art_utm_v1`: `{ utm_source, utm_medium, utm_campaign: "q4_powertool_eu", utm_content: "<variant_id>" }`. Character counts computed at fixture write time.

**One deliberate brand-voice violation:** `v_g_specifier` headline uses "revolutionary" so QA flags a `fail` against Brand Voice v2 (no hype words). One `warn` too: `v_li_rental` body 612 chars (over LinkedIn 600 soft cap).

**Localizations (3):**
- `de-DE` — `complete`, full variant set
- `de-AT` — `needs_review`, "Baustelle" vs "Bauplatz", VAT note "inkl. 20% USt."
- `de-CH` — `in_progress`, partial variants, CHF pricing
- `fr-FR` — listed in selector but `available: false` / `pending` with empty variants

Attach bundle to camp_04's `content` node and set `payload: contentBundle.source`. Update its summary to "7 variants across 5 channels · 3 locales".

Update camp_04 `qa` node `validations` to include the realistic mix:
- `UTM Format v1` — pass
- `Naming Convention v1` — pass
- `Link Validity` — pass
- `Brand Voice v2` — **fail**, excerpt "revolutionary new impact wrench", variant_id `v_g_specifier`
- `Char Limit · LinkedIn body ≤600` — **warn**, excerpt first 80 chars, variant_id `v_li_rental`

## 3. Store (`src/store/luban.ts`)

New state slice keyed by campaign id:

```ts
contentBundles: Record<string, ContentBundle>;
contentHistory: Record<string, ContentBundle[]>;  // for Undo regenerate (cap at 3)
```

New actions:
- `getContentBundle(campaignId)` selector
- `updateContentVariant(campaignId, variantId, patch)` — patches source variant, recomputes `characterCounts`, re-runs the simple brand-voice check, updates the matching QA validation in the active campaign node, toast on save
- `flagVariant(campaignId, variantId, flag: "ok" | "flag")` — used by H2 quick actions; persisted on a `reviewFlags` map keyed by `${campaignId}:${variantId}`
- `requestTranslation(campaignId, locale)` — sets `translationStatus: "in_progress"`, after 1.2s sets `complete` and fills variants by copying source + locale tag, toast
- `regenerateContent(campaignId)` — push current bundle onto `contentHistory`, after 1.5s swap source variants for an alternate fixture set (provide `altVariantsForCamp04` in fixtures), toast with progress
- `undoRegenerate(campaignId)` — pop last history entry
- `runAutoFix(campaignId, variantId)` — async; after 1.2s replace the offending copy (drop "revolutionary" etc.), re-run validation, toast

Wire `approveH2` to set any variants currently `flag`'d into the gate decision note automatically (concatenated list).

## 4. Content workspace route (`src/routes/content.$campaignId.tsx`)

New TanStack route, file `content.$campaignId.tsx` → `createFileRoute("/content/$campaignId")`. Layout:

- **Header**: campaign name, status pill, cost chip, "View workflow →" link to `/campaign/$id`
- **Toolbar row 1 — Locale selector**: segmented control of locales from the bundle plus greyed `fr-FR`. Switching swaps the rendered variant set. Includes `[Side-by-side]` toggle that splits into 2 cols (source vs selected locale, only enabled when locale ≠ source). "Request Translation" button (only when status ≠ complete).
- **Toolbar row 2 — Channel filter**: `All | LinkedIn | Google | Meta | Email | HOL` as `ToggleGroup`. `[Card | List]` view toggle on the right. `[Regenerate content]` button (with `[Undo]` shown when history exists).
- **Card View**: grid of `VariantCard` (component below). 1-col on side-by-side, 2-col otherwise.
- **List View**: shadcn `Table` — headline, channel, segment, char counts, QA badge, edit action.

## 5. Shared components

- `src/components/content/VariantCard.tsx` — props: `variant`, `compareTo?`, `readOnly?`, `quickAction?: "h2"`, `qaState?: "ok" | "warn" | "fail"`. Renders channel icon + segment chip, ad-style headline (`text-lg font-semibold`), full body, styled CTA button (non-interactive when readOnly), UTM mono badge, char counts (red when over limit), QA dot in corner. Edit button toggles inline editing (headline + body + CTA as Textareas with live char counters, Save/Cancel; Save calls `updateContentVariant`, toast). When `quickAction === "h2"` shows `[✓ Looks good] [⚠ Flag]` row.
- `src/components/content/LocaleStatusBadge.tsx` — pill with status text + icon.
- `src/components/content/ChannelIcon.tsx` — Linkedin/Search/Facebook/Mail/Globe from lucide.

## 6. QA panel (`src/components/panels/QAPanel.tsx`)

- One card per validation. Left border color by result (green/yellow/red).
- `pass`: rule name + "All variants conform" (or rule-specific text).
- `warn`: rule name + excerpt + variant link + `[Review]` button (opens content workspace scrolled/highlighted to that variant id).
- `fail`: rule name + quoted rule + excerpt + `[Fix]` button → `runAutoFix(...)`; button shows loading spinner, then success toast and the card flips to `pass`.
- Header shows `passed / total` summary.

## 7. Node detail panel updates (`src/components/panels/NodeDetailPanel.tsx`)

- `node.id === "content"`: drop the bare summary; render `<VariantCard readOnly>` grid (compact, channel-filtered to top 4 with "View full workspace →" link to `/content/$campaignId`).
- `node.kind === "tool" && node.id === "qa"`: render `<QAPanel validations={node.validations} campaignId={...} />` instead of the existing inline checks list.
- `node.id === "rollout"`: keep current connector-calls block but render each call as a `Step` row with status icon (`Loader2` while pending → `Check` on ok → `XCircle` on error) instead of plain text.

## 8. H2 gate updates (`src/components/panels/GatePanel.tsx`, H2 branch)

Above the signature pad:
- "Content for review (N)" header with `passed / total` QA chip linking to QA tab.
- Scrollable list of `VariantCard readOnly quickAction="h2"`. Quick-action buttons mutate `reviewFlags`.
- A live "Flagged: v_li_rental, v_g_specifier" line appears as soon as any are flagged; on Approve, this list is appended to the gate decision `note` automatically and any flagged variants get `verdict: changes_requested` instead (override the approve action when flags > 0, with a confirm toast).

## 9. Sidebar nav (`src/components/shell/Sidebar.tsx`)

Insert a "Content" link between Campaigns and Skills, icon `PenLine`. It links to `/content/camp_04` (the active in-progress campaign id pulled from the store's `activeCampaignId`). Hidden if no active campaign has a content bundle.

## 10. Routing target for QA "Review" / NodeDetail "View workspace"

Use TanStack search params: `Link to="/content/$campaignId" search={{ focus: variantId }}`. Workspace reads `Route.useSearch()` and on mount scrolls the matching `VariantCard` into view with a 1.5s red ring.

## Out of scope

- Real translation API (all locales are fixtures + simulated delay)
- Persisting edits beyond the in-memory Zustand store
- Editing localized variants (source-only editing per spec; localized cards are read-only)
- Adding new variants (edit existing only)

## Files

New:
- `src/routes/content.$campaignId.tsx`
- `src/components/content/VariantCard.tsx`
- `src/components/content/LocaleStatusBadge.tsx`
- `src/components/content/ChannelIcon.tsx`
- `src/components/panels/QAPanel.tsx`

Modified:
- `src/types.ts`
- `src/fixtures.ts` (bundle + alt variants + QA fail/warn)
- `src/store/luban.ts` (state + 6 actions)
- `src/components/panels/NodeDetailPanel.tsx`
- `src/components/panels/GatePanel.tsx`
- `src/components/shell/Sidebar.tsx`
