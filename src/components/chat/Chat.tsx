import { useEffect, useRef, useState } from "react";
import { useLuban, type ChatMessage } from "@/store/luban";
import { SUGGESTED_PROMPT, OFF_SCRIPT_FALLBACK, TEMPLATE_ID } from "@/lib/chatScript";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { ArchetypeSelectCard } from "@/components/chat/ArchetypeSelectCard";

const ACTION_TO_TAB: Record<string, { id: string; label: string }> = {
  "open-h1": { id: "h1", label: "H1 — Brief Approval" },
  "open-h2": { id: "h2", label: "H2 — Content Review" },
  "open-h3": { id: "h3", label: "H3 — Publish Gate" },
  "open-h4": { id: "h4", label: "H4 — Insights & Promotion" },
};

export function Chat() {
  const navigate = useNavigate();
  const messages = useLuban((s) => s.chat);
  const addUser = useLuban((s) => s.addUserMessage);
  const addAgent = useLuban((s) => s.addAgentMessage);
  const run = useLuban((s) => s.runOpeningSequence);
  const openTab = useLuban((s) => s.openTab);
  const setCenter = useLuban((s) => s.setCenterView);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async (text: string) => {
    if (!text.trim() || busy) return;
    addUser(text);
    setInput("");
    setBusy(true);
    const isExpected = text.trim().toLowerCase().includes("q4 power tool");
    if (!isExpected) {
      addAgent({ text: OFF_SCRIPT_FALLBACK });
      await new Promise((r) => setTimeout(r, 700));
    }
    await run();
    setBusy(false);
  };

  const openGate = (actionKind: string) => {
    const tab = ACTION_TO_TAB[actionKind];
    if (!tab) return;
    openTab({ ...tab, kind: "gate" });
    setCenter("graph");
    navigate({ to: "/campaign/$id", params: { id: "camp_04" } });
  };

  const openNodeTab = (nodeId: string, label: string) => {
    openTab({ id: nodeId, label, kind: "node" });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold">Luban</div>
          <div className="text-[11px] text-muted-foreground">Agentic marketing copilot</div>
        </div>
        <div className="ml-auto text-[10px] font-mono text-muted-foreground">
          template: {TEMPLATE_ID}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
        {messages.length === 0 && (
          <div className="max-w-xl mx-auto text-center pt-16 space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/15">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold">What campaign shall we launch?</h1>
            <p className="text-sm text-muted-foreground">
              Describe your goal in plain language. I'll plan it, run it past you at every gate (H1 → H4), and reuse skills from prior campaigns.
            </p>
            <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-4 text-left text-xs">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Available templates</div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono">paid-media-launch-v1</span>
                  <span className="text-success">active</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-mono">product-launch-v1</span>
                  <span>greyed</span>
                </div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="font-mono">regional-rollout-v1</span>
                  <span>greyed</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {messages.map((m) => (
          <Message key={m.id} m={m} onOpenGate={openGate} onOpenNode={openNodeTab} />
        ))}
        {busy && messages.length > 0 && messages[messages.length - 1].role === "user" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3 h-3 animate-spin" /> Luban is working…
          </div>
        )}
      </div>

      <div className="px-6 pb-6 pt-2 border-t border-border bg-background">
        {messages.length === 0 && (
          <button
            disabled={busy}
            onClick={() => handleSend(SUGGESTED_PROMPT)}
            className="mb-3 inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full bg-muted hover:bg-muted/70 border border-border"
          >
            <Sparkles className="w-3 h-3 text-accent" />
            {SUGGESTED_PROMPT}
          </button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex gap-2 items-end"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend(input);
              }
            }}
            placeholder="Ask Luban to plan a campaign…"
            rows={1}
            disabled={busy}
            className="flex-1 resize-none bg-muted/40 border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
          />
          <Button type="submit" disabled={busy || !input.trim()} className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-4">
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}

function Message({
  m,
  onOpenGate,
  onOpenNode,
}: {
  m: ChatMessage;
  onOpenGate: (kind: string) => void;
  onOpenNode: (id: string, label: string) => void;
}) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm fade-in-up">
          {m.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3 fade-in-up">
      <div className="w-7 h-7 shrink-0 rounded-md bg-primary/15 flex items-center justify-center mt-0.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex-1 space-y-2 max-w-[80%]">
        {m.archetype_pick && <ArchetypeSelectCard pick={m.archetype_pick} />}
        {m.text && (
          <div className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/95">{m.text}</div>
        )}
        {m.progress && (
          <div className="rounded-lg border border-border bg-card p-3 font-mono text-[12px] space-y-1.5">
            {m.progress.map((p) => (
              <div key={p.nodeId} className="flex items-center gap-2">
                <span className={p.state === "done" ? "text-success" : p.state === "running" ? "text-primary" : "text-muted-foreground"}>
                  {p.state === "done" ? "✓" : p.state === "running" ? <Loader2 className="inline w-3 h-3 animate-spin" /> : "○"}
                </span>
                <span className={p.state === "pending" ? "text-muted-foreground" : "text-foreground/90"}>
                  {p.label}
                </span>
                {p.state === "done" && p.viewLabel && (
                  <button
                    onClick={() => onOpenNode(p.nodeId, p.viewLabel!)}
                    className="ml-auto text-[11px] text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    {p.viewLabel} <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {m.action && (
          <Button onClick={() => onOpenGate(m.action!.kind)} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {m.action.label}
          </Button>
        )}
      </div>
    </div>
  );
}
