import { useState } from "react";
import { Sparkles, Loader2, ArrowRight } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useLuban } from "@/store/luban";
import { SUGGESTED_PROMPT } from "@/lib/chatScript";

/** Extra example prompts alongside the canonical SUGGESTED_PROMPT. */
const EXTRA_PROMPTS = [
  "Run a regional roll-out of the spring concrete anchor campaign for DE + FR markets.",
  "Plan a content update for the cordless platform line, EU contractor segment.",
];

export function BriefEntry() {
  const runBriefFlow = useLuban((s) => s.runBriefFlow);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    const brief = text.trim();
    if (!brief || busy) return;
    setBusy(true);
    setText("");
    try {
      await runBriefFlow(brief);
    } finally {
      setBusy(false);
    }
  };

  const chips = [SUGGESTED_PROMPT, ...EXTRA_PROMPTS];

  return (
    <div className="rounded-lg border border-border bg-background p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Campaign brief
        </div>
        {busy && (
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Planning…
          </div>
        )}
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            void handleSubmit();
          }
        }}
        placeholder="Describe the campaign you want Luban to plan — segment, market, product, goal…"
        rows={3}
        disabled={busy}
        className="resize-none bg-muted/40 border-border text-sm focus-visible:ring-primary/40"
      />

      <div className="flex flex-wrap gap-1.5">
        {chips.map((prompt, i) => (
          <button
            key={prompt}
            type="button"
            disabled={busy}
            onClick={() => setText(prompt)}
            className={
              "inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border border-border " +
              (i === 0
                ? "bg-accent/10 hover:bg-accent/20 text-foreground"
                : "bg-muted hover:bg-muted/70 text-muted-foreground") +
              " disabled:opacity-50 disabled:cursor-not-allowed"
            }
          >
            {i === 0 && <Sparkles className="w-3 h-3 text-accent" />}
            {prompt}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <div className="text-[10px] text-muted-foreground">
          ⌘/Ctrl + Enter to submit
        </div>
        <Button
          type="button"
          size="sm"
          disabled={busy || !text.trim()}
          onClick={() => void handleSubmit()}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {busy ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Planning
            </>
          ) : (
            <>
              Plan this campaign <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
