import { useRef, useState, useEffect } from "react";
import { useLuban } from "@/store/luban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, AlertTriangle, X as XIcon, Eraser, PenLine, Type, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { skillNameById } from "@/fixtures";
import { cn } from "@/lib/utils";
import type { GateId } from "@/types";
import { VariantCard } from "@/components/content/VariantCard";
import { Link } from "@tanstack/react-router";
import { AdaptedPlanDiff } from "@/components/panels/AdaptedPlanDiff";

type Mode = "draw" | "type";

export function SignaturePad({
  mode,
  typed,
  setTyped,
  onCanvasReady,
  onStrokeChange,
}: {
  mode: Mode;
  typed: string;
  setTyped: (v: string) => void;
  onCanvasReady: (c: HTMLCanvasElement | null) => void;
  onStrokeChange: (hasInk: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    onCanvasReady(canvasRef.current);
    const c = canvasRef.current;
    if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = c.getBoundingClientRect();
    c.width = rect.width * ratio;
    c.height = rect.height * ratio;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = "#ffffff";
    }
  }, [mode, onCanvasReady]);

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    const c = canvasRef.current;
    if (!c) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = c.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasInk.current) {
      hasInk.current = true;
      onStrokeChange(true);
    }
  };
  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    hasInk.current = false;
    onStrokeChange(false);
  };

  if (mode === "type") {
    return (
      <input
        type="text"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        placeholder="Type signature"
        className="w-full h-16 px-3 bg-background border border-border rounded-md text-2xl italic"
        style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}
      />
    );
  }

  return (
    <div className="relative rounded-md border border-border bg-background">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-24 touch-none cursor-crosshair block"
      />
      <button
        type="button"
        onClick={clear}
        className="absolute bottom-1 right-1 text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 px-1.5 py-0.5 rounded"
      >
        <Eraser className="w-3 h-3" /> Clear
      </button>
    </div>
  );
}

interface GateConfig {
  gate: GateId;
  nodeId: "h1" | "h2" | "h3";
  title: string;
  role: string;
  whatIsShown: React.ReactNode;
  whatItUnblocks: string;
  approveLabel: string;
  rejectLabel?: string;
  changesLabel?: string;
  approveAction: (signer: string, sig: string, kind: "drawn" | "typed") => void;
  rejectAction?: (signer: string, sig: string, kind: "drawn" | "typed") => void;
  changesAction?: (signer: string, sig: string, kind: "drawn" | "typed") => void;
}

export function GatePanel({ config }: { config: GateConfig }) {
  const camp = useLuban((s) => s.getActive());
  const node = camp.nodes.find((n) => n.id === config.nodeId);
  const sla = camp.sla_per_gate_hours?.[config.gate];

  const [signer, setSigner] = useState("");
  const [mode, setMode] = useState<Mode>("draw");
  const [typed, setTyped] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (node?.decision) return <SignedView gate={config} node={node} />;

  const collectSignature = () => {
    if (mode === "type") {
      const v = typed.trim();
      if (!v) return null;
      return { sig: v, kind: "typed" as const };
    }
    if (!hasInk || !canvasRef.current) return null;
    return { sig: canvasRef.current.toDataURL("image/png"), kind: "drawn" as const };
  };

  const guardAndRun = (action?: (s: string, sig: string, k: "drawn" | "typed") => void, label?: string) => {
    if (!action) return;
    const name = signer.trim();
    if (!name) return toast.error("Enter your name to sign");
    const s = collectSignature();
    if (!s) return toast.error(mode === "type" ? "Type your signature" : "Draw your signature");
    action(name, s.sig, s.kind);
    if (label) toast.success(label);
  };

  return (
    <div className="border-l-4 border-primary -ml-px">
      <div className="p-5 space-y-4">
        <div>
          <div className="text-xs flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary pulse-red" />
            <span className="font-mono text-muted-foreground">
              {config.gate} · {config.role}
            </span>
          </div>
          <h2 className="text-lg font-semibold">{config.title}</h2>
          {sla && <div className="mt-2 text-xs text-muted-foreground">⏱ SLA: {sla}h</div>}
        </div>

        <div className="space-y-3">{config.whatIsShown}</div>

        {config.gate === "H1" && camp.archetype && <AdaptedPlanDiff />}

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="signer-name" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Signer name
            </Label>
            <Input
              id="signer-name"
              value={signer}
              onChange={(e) => setSigner(e.target.value)}
              placeholder={`e.g. Alex — ${config.role}`}
              className="h-9"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Signature</Label>
              <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setMode("draw")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded text-[10px]",
                    mode === "draw" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <PenLine className="w-3 h-3" /> Draw
                </button>
                <button
                  type="button"
                  onClick={() => setMode("type")}
                  className={cn(
                    "flex items-center gap-1 px-2 py-0.5 rounded text-[10px]",
                    mode === "type" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  <Type className="w-3 h-3" /> Type
                </button>
              </div>
            </div>
            <SignaturePad
              mode={mode}
              typed={typed}
              setTyped={setTyped}
              onCanvasReady={(c) => (canvasRef.current = c)}
              onStrokeChange={setHasInk}
            />
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Approving unblocks: <span className="text-foreground">{config.whatItUnblocks}</span>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => guardAndRun(config.approveAction, `${config.gate} ${config.approveLabel}`)}
          >
            {config.approveLabel}
          </Button>
          <div className="flex gap-2">
            {config.changesAction && (
              <Button variant="outline" className="flex-1" onClick={() => guardAndRun(config.changesAction, "Changes requested")}>
                {config.changesLabel ?? "Request Changes"}
              </Button>
            )}
            {config.rejectAction && (
              <Button
                variant="outline"
                className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10"
                onClick={() => guardAndRun(config.rejectAction, config.rejectLabel ?? "Rejected")}
              >
                {config.rejectLabel ?? "Reject"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SignedView({ gate, node }: { gate: { gate: GateId; title: string }; node: any }) {
  const d = node.decision!;
  return (
    <div className="p-5 border-l-4 border-primary -ml-px space-y-4">
      <h2 className="text-base font-semibold flex items-center gap-2">
        {d.verdict === "approved" ? (
          <Check className="w-4 h-4 text-success" />
        ) : d.verdict === "rejected" ? (
          <XIcon className="w-4 h-4 text-destructive" />
        ) : (
          <AlertTriangle className="w-4 h-4 text-warning" />
        )}
        {gate.gate} — {gate.title}
      </h2>
      <div className="rounded-md border border-border bg-background p-3 text-xs space-y-1">
        <div>
          <span className="text-muted-foreground">Verdict:</span>{" "}
          <span className="font-semibold capitalize">{d.verdict.replace("_", " ")}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Signer:</span> {d.reviewer}
        </div>
        <div>
          <span className="text-muted-foreground">Note:</span> {d.note}
        </div>
        {d.decided_at && <div className="text-muted-foreground">{new Date(d.decided_at).toLocaleString()}</div>}
      </div>
      {d.signature && (
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Signature</div>
          {d.signature_kind === "typed" ? (
            <div
              className="text-2xl italic text-foreground"
              style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}
            >
              {d.signature}
            </div>
          ) : (
            <img src={d.signature} alt="Signature" className="h-16 w-auto bg-background" />
          )}
          <div className="text-[10px] text-muted-foreground mt-2">
            Signed by {d.reviewer} · {d.decided_at && new Date(d.decided_at).toLocaleString()}
          </div>
        </div>
      )}
      {d.proposal_actions && d.proposal_actions.length > 0 && (
        <div className="rounded-md border border-border bg-background p-3 text-xs">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Proposal actions</div>
          <ul className="space-y-1">
            {d.proposal_actions.map((a: any) => (
              <li key={a.proposal_id} className="flex items-center justify-between">
                <span className="font-mono text-[11px]">{a.proposal_id}</span>
                <span className={a.action === "promote" ? "text-success" : "text-muted-foreground"}>{a.action}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Per-gate config builders ----------------------------------------------------

export function useGateConfig(gate: GateId): GateConfig | null {
  const camp = useLuban((s) => s.getActive());
  const approveH1 = useLuban((s) => s.approveH1);
  const changesH1 = useLuban((s) => s.requestChangesH1);
  const rejectH1 = useLuban((s) => s.rejectH1);
  const approveH2 = useLuban((s) => s.approveH2);
  const changesH2 = useLuban((s) => s.requestChangesH2);
  const rejectH2 = useLuban((s) => s.rejectH2);
  const approveH3 = useLuban((s) => s.approveH3);
  const holdH3 = useLuban((s) => s.holdH3);

  if (gate === "H1") {
    const brief = camp.nodes.find((n) => n.id === "brief");
    return {
      gate: "H1", nodeId: "h1",
      title: "Awaiting your sign-off",
      role: "Campaign Strategist",
      whatIsShown: (
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Brief</div>
          <div className="text-xs leading-relaxed">{brief?.output?.summary}</div>
          <div className="mt-2 text-[10px] text-muted-foreground font-mono">
            ${brief?.output?.cost_usd?.toFixed(2)} · {brief?.confidence ? `${Math.round(brief.confidence * 100)}% conf` : ""}
          </div>
        </div>
      ),
      whatItUnblocks: "Strategy → Content → QA → H2",
      approveLabel: "Approve & Sign",
      changesLabel: "Request Changes",
      rejectLabel: "Reject",
      approveAction: approveH1, changesAction: changesH1, rejectAction: rejectH1,
    };
  }
  if (gate === "H2") {
    const strategy = camp.nodes.find((n) => n.id === "strategy");
    const content = camp.nodes.find((n) => n.id === "content");
    const qa = camp.nodes.find((n) => n.id === "qa");
    const validations = qa?.validations ?? [];
    const passed = validations.filter((v) => v.result === "pass").length;
    const failed = validations.filter((v) => v.result === "fail").length;
    const warned = validations.filter((v) => v.result === "warn").length;
    const allSkills = Array.from(new Set([
      ...(strategy?.output?.resolved_skills ?? []),
      ...(content?.output?.resolved_skills ?? []),
      ...(qa?.output?.resolved_skills ?? []),
    ]));
    return {
      gate: "H2", nodeId: "h2",
      title: "Awaiting your sign-off",
      role: "Brand Lead",
      whatIsShown: <H2Body campaignId={camp.id} skills={allSkills} qaSummary={{ passed, warned, failed, total: validations.length }} />,
      whatItUnblocks: "Roll-out → H3 → Publish",
      approveLabel: "Approve & Sign",
      changesLabel: "Request Changes",
      rejectLabel: "Reject",
      approveAction: approveH2, changesAction: changesH2, rejectAction: rejectH2,
    };
  }
  if (gate === "H3") {
    const rollout = camp.nodes.find((n) => n.id === "rollout");
    const calls = rollout?.connector_calls ?? [];
    return {
      gate: "H3", nodeId: "h3",
      title: "Publish to production?",
      role: "Campaign Ops Manager",
      whatIsShown: (
        <div className="rounded-md border border-border bg-background p-3">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Staged connector calls</div>
          <ul className="space-y-1">
            {calls.map((c, i) => (
              <li key={i} className="flex items-center justify-between text-[11px]">
                <span className="font-mono text-muted-foreground">{c.connector_id}</span>
                <span className="truncate ml-2 text-foreground/80">{c.action} · {c.target}</span>
                <span className={cn("ml-2 text-[10px]", c.status === "ok" ? "text-success" : "text-muted-foreground")}>
                  {c.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ),
      whatItUnblocks: "Publish → Insights → H4",
      approveLabel: "Publish & Sign",
      rejectLabel: "Hold",
      approveAction: approveH3,
      rejectAction: holdH3,
    };
  }
  return null;
}

function H2Body({
  campaignId,
  skills,
  qaSummary,
}: {
  campaignId: string;
  skills: string[];
  qaSummary: { passed: number; warned: number; failed: number; total: number };
}) {
  const bundle = useLuban((s) => s.contentBundles[campaignId]);
  const variants = bundle?.source.variants ?? [];
  const flags = useLuban((s) => s.reviewFlags);
  const flaggedCount = Object.entries(flags).filter(
    ([k, v]) => k.startsWith(`${campaignId}:`) && v === "flag",
  ).length;
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-border bg-background p-3 flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Brand QA</div>
          <div className="text-xs">
            <span className="font-mono">{qaSummary.passed}/{qaSummary.total}</span> pass
            {qaSummary.warned > 0 && <span className="text-warning"> · {qaSummary.warned} warn</span>}
            {qaSummary.failed > 0 && <span className="text-destructive"> · {qaSummary.failed} fail</span>}
          </div>
        </div>
        <Link
          to="/content/$campaignId"
          params={{ campaignId }}
          className="text-[11px] text-primary hover:underline inline-flex items-center gap-1"
        >
          Open QA <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Content to review ({variants.length})
          </div>
          {flaggedCount > 0 && (
            <span className="text-[10px] text-warning">{flaggedCount} flagged</span>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1 rounded-md border border-border bg-muted/10 p-2">
          {variants.map((v) => (
            <VariantCard
              key={v.id}
              campaignId={campaignId}
              variant={v}
              readOnly
              quickAction="h2"
            />
          ))}
        </div>
      </div>

      {skills.length > 0 && (
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Skills used</div>
          <div className="flex flex-wrap gap-1">
            {skills.map((id) => (
              <span key={id} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px]">
                {skillNameById(id)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
