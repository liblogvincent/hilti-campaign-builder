import { useLuban } from "@/store/luban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, AlertTriangle, X as XIcon, Eraser, PenLine, Type } from "lucide-react";
import { toast } from "sonner";
import { skillNameById } from "@/fixtures";
import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type Mode = "draw" | "type";

function SignaturePad({
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
    // Set actual pixel size for crispness
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
      <div className="space-y-1">
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder="Type signature"
          className="w-full h-16 px-3 bg-background border border-border rounded-md text-2xl italic"
          style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-1">
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
      <p className="text-[10px] text-muted-foreground">Draw your signature above</p>
    </div>
  );
}

export function H2GatePanel() {
  const camp = useLuban((s) => s.getActive());
  const approve = useLuban((s) => s.approveH2);
  const changes = useLuban((s) => s.requestChangesH2);
  const reject = useLuban((s) => s.rejectH2);
  const h2 = camp.nodes.find((n) => n.id === "h2");

  const [signer, setSigner] = useState("");
  const [mode, setMode] = useState<Mode>("draw");
  const [typed, setTyped] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (h2?.decision) {
    const d = h2.decision;
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
          H2 — Content Review
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
          {d.decided_at && (
            <div className="text-muted-foreground">{new Date(d.decided_at).toLocaleString()}</div>
          )}
        </div>
        {d.signature && (
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Signature
            </div>
            {d.signature_kind === "typed" ? (
              <div
                className="text-2xl italic text-foreground"
                style={{ fontFamily: "'Brush Script MT', 'Lucida Handwriting', cursive" }}
              >
                {d.signature}
              </div>
            ) : (
              <img
                src={d.signature}
                alt="Signature"
                className="h-16 w-auto bg-background"
              />
            )}
            <div className="text-[10px] text-muted-foreground mt-2">
              Signed by {d.reviewer} · {d.decided_at && new Date(d.decided_at).toLocaleString()}
            </div>
          </div>
        )}
      </div>
    );
  }

  const strategy = camp.nodes.find((n) => n.id === "strategy");
  const content = camp.nodes.find((n) => n.id === "content");
  const qa = camp.nodes.find((n) => n.id === "qa");
  const checks = ((qa?.output?.payload as any)?.checks ?? []) as { rule: string; result: string }[];

  const allSkills = Array.from(
    new Set([
      ...(strategy?.output?.resolved_skills ?? []),
      ...(content?.output?.resolved_skills ?? []),
      ...(qa?.output?.resolved_skills ?? []),
    ]),
  );

  const collectSignature = (): { sig: string; kind: "drawn" | "typed" } | null => {
    if (mode === "type") {
      const v = typed.trim();
      if (!v) return null;
      return { sig: v, kind: "typed" };
    }
    if (!hasInk || !canvasRef.current) return null;
    return { sig: canvasRef.current.toDataURL("image/png"), kind: "drawn" };
  };

  const guardAndRun = (action: (s: string, sig: string, k: "drawn" | "typed") => void, label: string) => {
    const name = signer.trim();
    if (!name) {
      toast.error("Enter your name to sign");
      return;
    }
    const s = collectSignature();
    if (!s) {
      toast.error(mode === "type" ? "Type your signature" : "Draw your signature");
      return;
    }
    action(name, s.sig, s.kind);
    toast.success(label);
  };

  return (
    <div className="border-l-4 border-primary -ml-px">
      <div className="p-5 space-y-4">
        <div>
          <div className="text-xs flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary pulse-red" />
            <span className="font-mono text-muted-foreground">H2 · Content Review</span>
          </div>
          <h2 className="text-lg font-semibold">Awaiting your sign-off</h2>
          <div className="mt-2 text-xs text-muted-foreground">⏱ SLA: 18 hours remaining</div>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Strategy Plan</div>
            <div className="text-xs">5-channel plan · 4 skills reused · <span className="font-mono">$10.80</span></div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Content Generation</div>
            <div className="text-xs">3 variants × 3 channels · <span className="font-mono">$12.60</span></div>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">QA Report — 4/4 passed</div>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {checks.map((c) => (
                <div key={c.rule} className="flex items-center gap-1 text-[11px] text-success">
                  <Check className="w-3 h-3" /> {c.rule}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Skills used</div>
          <div className="flex flex-wrap gap-1">
            {allSkills.map((id) => (
              <span key={id} className="px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px]">
                {skillNameById(id)}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="signer-name" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Signer name
            </Label>
            <Input
              id="signer-name"
              value={signer}
              onChange={(e) => setSigner(e.target.value)}
              placeholder="e.g. Alex Brand-Lead"
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
          Approving unblocks: <span className="text-foreground">Roll-out → Publish → Learn</span>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={() => guardAndRun(approve, "H2 Approved — Roll-out unblocked")}
          >
            Approve & Sign
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => guardAndRun(changes, "Changes requested")}
            >
              Request Changes
            </Button>
            <Button
              variant="outline"
              className="flex-1 text-destructive border-destructive/40 hover:bg-destructive/10"
              onClick={() => guardAndRun(reject, "Campaign rejected")}
            >
              Reject
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
