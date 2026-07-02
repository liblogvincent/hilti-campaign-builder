import { useState, useEffect } from "react";
import type { AdVariant, AdChannel } from "@/types";
import { ChannelIcon, channelLabel } from "./ChannelIcon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useLuban } from "@/store/luban";
import { cn } from "@/lib/utils";
import { Pencil, Check, X, Flag, ThumbsUp, AlertTriangle, ImageIcon } from "lucide-react";

type QAState = "ok" | "warn" | "fail";

const CHAR_LIMITS: Record<AdChannel, { headline: number; body: number }> = {
  linkedin: { headline: 70, body: 600 },
  google: { headline: 30, body: 90 },
  meta: { headline: 40, body: 125 },
  email: { headline: 70, body: 2000 },
  hol: { headline: 80, body: 1000 },
};

interface Props {
  campaignId: string;
  variant: AdVariant;
  compareTo?: AdVariant;
  readOnly?: boolean;
  quickAction?: "h2";
  qaState?: QAState;
  highlight?: boolean;
}

export function VariantCard({
  campaignId,
  variant,
  compareTo,
  readOnly,
  quickAction,
  qaState,
  highlight,
}: Props) {
  const updateContentVariant = useLuban((s) => s.updateContentVariant);
  const flagVariant = useLuban((s) => s.flagVariant);
  const flag = useLuban((s) => s.reviewFlags[`${campaignId}:${variant.id}`]);

  const [editing, setEditing] = useState(false);
  const [headline, setHeadline] = useState(variant.headline);
  const [body, setBody] = useState(variant.bodyCopy);
  const [cta, setCta] = useState(variant.cta);

  useEffect(() => {
    setHeadline(variant.headline);
    setBody(variant.bodyCopy);
    setCta(variant.cta);
  }, [variant.id, variant.headline, variant.bodyCopy, variant.cta]);

  const limits = CHAR_LIMITS[variant.channel];
  const over = {
    headline: headline.length > limits.headline,
    body: body.length > limits.body,
  };

  const save = () => {
    updateContentVariant(campaignId, variant.id, { headline, bodyCopy: body, cta });
    setEditing(false);
  };
  const cancel = () => {
    setHeadline(variant.headline);
    setBody(variant.bodyCopy);
    setCta(variant.cta);
    setEditing(false);
  };

  const qaColor =
    qaState === "fail"
      ? "border-l-destructive"
      : qaState === "warn"
        ? "border-l-warning"
        : "border-l-border";

  return (
    <div
      id={`variant-${variant.id}`}
      className={cn(
        "rounded-lg border border-border border-l-4 bg-card overflow-hidden transition-all",
        qaColor,
        highlight && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        flag === "flag" && "border-warning/60",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-2 min-w-0">
          <ChannelIcon channel={variant.channel} />
          <span className="text-xs font-medium">{channelLabel(variant.channel)}</span>
          <span className="text-[10px] text-muted-foreground truncate">· {variant.segment}</span>
        </div>
        <div className="flex items-center gap-1">
          {qaState === "fail" && (
            <span className="text-[10px] text-destructive flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> QA fail
            </span>
          )}
          {qaState === "warn" && (
            <span className="text-[10px] text-warning flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> QA warn
            </span>
          )}
          <span className="text-[10px] font-mono text-muted-foreground">{variant.id}</span>
        </div>
      </div>

      {/* Image placeholder (ads only) */}
      {variant.imagePlaceholder && (
        <div className="aspect-[16/9] bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center border-b border-border">
          <div className="flex flex-col items-center text-muted-foreground/70">
            <ImageIcon className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-mono">{variant.imagePlaceholder}</span>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="p-3 space-y-2">
        {compareTo ? (
          <CompareSplit a={compareTo} b={variant} />
        ) : editing ? (
          <>
            <FieldEdit
              label="Headline"
              value={headline}
              onChange={setHeadline}
              limit={limits.headline}
              over={over.headline}
              rows={2}
            />
            <FieldEdit
              label="Body"
              value={body}
              onChange={setBody}
              limit={limits.body}
              over={over.body}
              rows={5}
            />
            <FieldEdit label="CTA" value={cta} onChange={setCta} rows={1} />
          </>
        ) : (
          <>
            <div className="text-base font-semibold leading-snug">{variant.headline}</div>
            <div className="text-sm text-foreground/80 whitespace-pre-line">{variant.bodyCopy}</div>
            <Button
              size="sm"
              className="mt-1 h-8 bg-primary hover:bg-primary/90 text-primary-foreground pointer-events-none"
            >
              {variant.cta}
            </Button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2 border-t border-border bg-muted/20 text-[10px] space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "font-mono",
              over.headline ? "text-destructive" : "text-muted-foreground",
            )}
          >
            H {variant.characterCounts.headline}/{limits.headline}
          </span>
          <span
            className={cn(
              "font-mono",
              over.body ? "text-destructive" : "text-muted-foreground",
            )}
          >
            B {variant.characterCounts.body}/{limits.body}
          </span>
          <span className="font-mono text-muted-foreground">CTA {variant.characterCounts.cta}</span>
        </div>
        <div className="font-mono text-muted-foreground truncate" title={Object.entries(variant.utmParams).map(([k, v]) => `${k}=${v}`).join("&")}>
          {Object.entries(variant.utmParams)
            .map(([k, v]) => `${k}=${v}`)
            .join("&")}
        </div>
      </div>

      {/* Action row */}
      {!readOnly && (
        <div className="px-3 py-2 border-t border-border flex items-center justify-end gap-1.5">
          {editing ? (
            <>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancel}>
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={save}
              >
                <Check className="w-3 h-3 mr-1" /> Save
              </Button>
            </>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(true)}>
              <Pencil className="w-3 h-3 mr-1" /> Edit
            </Button>
          )}
        </div>
      )}

      {quickAction === "h2" && (
        <div className="px-3 py-2 border-t border-border flex items-center gap-2 bg-background">
          <button
            type="button"
            onClick={() => flagVariant(campaignId, variant.id, "ok")}
            className={cn(
              "flex-1 text-[11px] py-1.5 rounded-md border flex items-center justify-center gap-1",
              flag === "ok"
                ? "border-success bg-success/10 text-success"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <ThumbsUp className="w-3 h-3" /> Looks good
          </button>
          <button
            type="button"
            onClick={() => flagVariant(campaignId, variant.id, "flag")}
            className={cn(
              "flex-1 text-[11px] py-1.5 rounded-md border flex items-center justify-center gap-1",
              flag === "flag"
                ? "border-warning bg-warning/10 text-warning"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            <Flag className="w-3 h-3" /> Flag
          </button>
        </div>
      )}
    </div>
  );
}

function FieldEdit({
  label,
  value,
  onChange,
  limit,
  over,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  limit?: number;
  over?: boolean;
  rows: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        {limit !== undefined && (
          <span className={cn("text-[10px] font-mono", over ? "text-destructive" : "text-muted-foreground")}>
            {value.length}/{limit}
          </span>
        )}
      </div>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="text-sm"
      />
    </div>
  );
}

function CompareSplit({ a, b }: { a: AdVariant; b: AdVariant }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Source</div>
        <div className="text-sm font-semibold leading-snug">{a.headline}</div>
        <div className="text-xs text-foreground/80 whitespace-pre-line">{a.bodyCopy}</div>
        <div className="text-[10px] text-muted-foreground">CTA: {a.cta}</div>
      </div>
      <div className="space-y-1.5 border-l border-border pl-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Localized</div>
        <div className="text-sm font-semibold leading-snug">{b.headline}</div>
        <div className="text-xs text-foreground/80 whitespace-pre-line">{b.bodyCopy}</div>
        <div className="text-[10px] text-muted-foreground">CTA: {b.cta}</div>
      </div>
    </div>
  );
}
