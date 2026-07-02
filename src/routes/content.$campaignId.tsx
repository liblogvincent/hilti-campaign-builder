import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useLuban } from "@/store/luban";
import { VariantCard } from "@/components/content/VariantCard";
import { LocaleStatusBadge } from "@/components/content/LocaleStatusBadge";
import { ChannelIcon, channelLabel } from "@/components/content/ChannelIcon";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, LayoutGrid, List, RefreshCw, Undo2, Languages, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdChannel, AdVariant } from "@/types";
import { z } from "zod";

const searchSchema = z.object({
  focus: z.string().optional(),
});

export const Route = createFileRoute("/content/$campaignId")({
  validateSearch: searchSchema,
  component: ContentWorkspace,
  notFoundComponent: () => <div className="p-10">Campaign not found.</div>,
});

const CHANNELS: (AdChannel | "all")[] = ["all", "linkedin", "google", "meta", "email", "hol"];

function ContentWorkspace() {
  const { campaignId } = Route.useParams();
  const { focus } = Route.useSearch();
  const camp = useLuban((s) => s.getCampaign(campaignId));
  const bundle = useLuban((s) => s.contentBundles[campaignId]);
  const history = useLuban((s) => s.contentHistory[campaignId]);
  const regenerate = useLuban((s) => s.regenerateContent);
  const undo = useLuban((s) => s.undoRegenerate);
  const requestTranslation = useLuban((s) => s.requestTranslation);

  const [localeKey, setLocaleKey] = useState<string>("source");
  const [channel, setChannel] = useState<AdChannel | "all">("all");
  const [view, setView] = useState<"card" | "list">("card");
  const [sideBySide, setSideBySide] = useState(false);
  const [highlightId, setHighlightId] = useState<string | undefined>(focus);

  useEffect(() => {
    if (!focus) return;
    setHighlightId(focus);
    const t = setTimeout(() => {
      const el = document.getElementById(`variant-${focus}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
    const off = setTimeout(() => setHighlightId(undefined), 2000);
    return () => {
      clearTimeout(t);
      clearTimeout(off);
    };
  }, [focus]);

  const activeLoc =
    !bundle || localeKey === "source"
      ? null
      : bundle.localizations.find((l) => l.locale === localeKey) ?? null;
  const sourceVariants = bundle?.source.variants;
  const localizedVariants = activeLoc?.variants;
  const visibleVariants = useMemo(() => {
    const base = localeKey === "source" ? sourceVariants ?? [] : localizedVariants ?? [];
    return channel === "all" ? base : base.filter((v) => v.channel === channel);
  }, [localeKey, sourceVariants, localizedVariants, channel]);

  if (!camp) throw notFound();
  if (!bundle)
    return (
      <div className="p-8">
        <p className="text-sm text-muted-foreground">No content bundle for this campaign yet.</p>
        <Link to="/campaign/$id" params={{ id: campaignId }} className="text-primary text-sm hover:underline">
          ← Back to workflow
        </Link>
      </div>
    );

  const qaNode = camp.nodes.find((n) => n.id === "qa");
  const qaByVariant = new Map<string, "warn" | "fail">();
  qaNode?.validations?.forEach((v) => {
    if (v.variant_id && (v.result === "warn" || v.result === "fail")) {
      qaByVariant.set(v.variant_id, v.result);
    }
  });


  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <Link
            to="/campaign/$id"
            params={{ id: campaignId }}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3 h-3" /> Back to workflow
          </Link>
          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Content Workspace</div>
              <h1 className="text-xl font-semibold">{camp.name}</h1>
              <div className="mt-1 text-xs text-muted-foreground">
                {bundle.source.totalVariants} variants · {bundle.source.channels.length} channels · {bundle.localizations.length} locales
              </div>
            </div>
            <span
              className={cn(
                "shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium",
                camp.status === "Published"
                  ? "bg-success/15 text-success"
                  : camp.status === "In Progress"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {camp.status}
            </span>
          </div>
        </div>

        {/* Locale row */}
        <div className="rounded-lg border border-border bg-card p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Languages className="w-4 h-4 text-muted-foreground" />
            <button
              onClick={() => {
                setLocaleKey("source");
                setSideBySide(false);
              }}
              className={cn(
                "text-xs px-3 py-1 rounded-md border",
                localeKey === "source" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              Source (EN)
            </button>
            {bundle.localizations.map((l) => {
              const disabled = l.translationStatus === "pending" && l.variants.length === 0;
              return (
                <button
                  key={l.locale}
                  onClick={() => !disabled && setLocaleKey(l.locale)}
                  disabled={disabled}
                  className={cn(
                    "text-xs px-3 py-1 rounded-md border flex items-center gap-1.5",
                    localeKey === l.locale
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground",
                    disabled && "opacity-40 cursor-not-allowed",
                  )}
                >
                  {l.label}
                  <LocaleStatusBadge status={l.translationStatus} />
                </button>
              );
            })}
            <div className="ml-auto flex items-center gap-2">
              {activeLoc && activeLoc.translationStatus !== "complete" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => requestTranslation(campaignId, activeLoc.locale)}
                >
                  Request Translation
                </Button>
              )}
              <button
                onClick={() => setSideBySide((v) => !v)}
                disabled={!activeLoc}
                className={cn(
                  "text-xs px-2 py-1 rounded-md border flex items-center gap-1",
                  sideBySide ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
                  !activeLoc && "opacity-40 cursor-not-allowed",
                )}
                title="Side-by-side comparison"
              >
                <Columns2 className="w-3 h-3" /> Side-by-side
              </button>
            </div>
          </div>
          {activeLoc?.translatorNotes && (
            <div className="text-[11px] text-muted-foreground italic">Translator notes: {activeLoc.translatorNotes}</div>
          )}
        </div>

        {/* Channel filter + view toggle + regenerate */}
        <div className="flex items-center gap-2 flex-wrap">
          <ToggleGroup
            type="single"
            value={channel}
            onValueChange={(v) => v && setChannel(v as AdChannel | "all")}
            className="bg-card border border-border rounded-md p-0.5"
          >
            {CHANNELS.map((c) => (
              <ToggleGroupItem key={c} value={c} className="h-7 text-xs px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {c === "all" ? "All" : (
                  <span className="inline-flex items-center gap-1">
                    <ChannelIcon channel={c} className="w-3 h-3" />
                    {channelLabel(c)}
                  </span>
                )}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setView("card")}
              className={cn(
                "h-7 px-2 rounded-md border text-xs flex items-center gap-1",
                view === "card" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              <LayoutGrid className="w-3 h-3" /> Card
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "h-7 px-2 rounded-md border text-xs flex items-center gap-1",
                view === "list" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground",
              )}
            >
              <List className="w-3 h-3" /> List
            </button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => regenerate(campaignId)}
              disabled={localeKey !== "source"}
            >
              <RefreshCw className="w-3 h-3 mr-1" /> Regenerate
            </Button>
            {history && history.length > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => undo(campaignId)}>
                <Undo2 className="w-3 h-3 mr-1" /> Undo
              </Button>
            )}
          </div>
        </div>

        {/* Content */}
        {visibleVariants.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {activeLoc?.translationStatus === "pending"
                ? `${activeLoc.label} translation hasn't been requested yet.`
                : "No variants for this channel."}
            </p>
            {activeLoc?.translationStatus === "pending" && (
              <Button
                size="sm"
                className="mt-3 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => requestTranslation(campaignId, activeLoc.locale)}
              >
                Request Translation
              </Button>
            )}
          </div>
        ) : view === "list" ? (
          <ListView campaignId={campaignId} variants={visibleVariants} qaByVariant={qaByVariant} />
        ) : (
          <div className={cn("grid gap-4", sideBySide ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
            {visibleVariants.map((v) => {
              const compareTo =
                sideBySide && activeLoc ? sourceVariants.find((s) => s.id === v.id) : undefined;
              return (
                <VariantCard
                  key={v.id}
                  campaignId={campaignId}
                  variant={v}
                  compareTo={compareTo}
                  qaState={qaByVariant.get(v.id)}
                  highlight={highlightId === v.id}
                  readOnly={localeKey !== "source"}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ListView({
  campaignId,
  variants,
  qaByVariant,
}: {
  campaignId: string;
  variants: AdVariant[];
  qaByVariant: Map<string, "warn" | "fail">;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Headline</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Segment</TableHead>
            <TableHead className="text-right">H</TableHead>
            <TableHead className="text-right">B</TableHead>
            <TableHead>QA</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {variants.map((v) => {
            const qa = qaByVariant.get(v.id);
            return (
              <TableRow key={v.id}>
                <TableCell className="font-medium max-w-[280px] truncate">{v.headline}</TableCell>
                <TableCell className="text-xs">
                  <span className="inline-flex items-center gap-1">
                    <ChannelIcon channel={v.channel} className="w-3 h-3" />
                    {channelLabel(v.channel)}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{v.segment}</TableCell>
                <TableCell className="text-right font-mono text-xs">{v.characterCounts.headline}</TableCell>
                <TableCell className="text-right font-mono text-xs">{v.characterCounts.body}</TableCell>
                <TableCell>
                  {qa === "fail" ? (
                    <span className="text-[10px] text-destructive">fail</span>
                  ) : qa === "warn" ? (
                    <span className="text-[10px] text-warning">warn</span>
                  ) : (
                    <span className="text-[10px] text-success">pass</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link
                    to="/content/$campaignId"
                    params={{ campaignId }}
                    search={{ focus: v.id }}
                    className="text-xs text-primary hover:underline"
                  >
                    Edit
                  </Link>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
