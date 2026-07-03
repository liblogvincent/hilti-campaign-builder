import { useState, useRef } from "react";
import { useLuban } from "@/store/luban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, X as XIcon, Sparkles, AlertTriangle, PenLine, Type as TypeIcon } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SignaturePad, SignedView } from "./GatePanel";

type Action = "promote" | "reject" | null;

export function H4InsightsPanel() {
  const camp = useLuban((s) => s.getActive());
  const proposals = useLuban((s) => s.proposals);
  const approveH4 = useLuban((s) => s.approveH4);
  const node = camp.nodes.find((n) => n.id === "h4");

  const [signer, setSigner] = useState("");
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [typed, setTyped] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [decisions, setDecisions] = useState<Record<string, Action>>({});

  if (node?.decision) return <SignedView gate={{ gate: "H4", title: "Insights & Skill Promotion" }} node={node} />;

  const open = proposals.filter((p) => p.status === "Proposed");

  const setAction = (id: string, action: Action) => setDecisions((d) => ({ ...d, [id]: action }));

  const collectSignature = () => {
    if (mode === "type") {
      const v = typed.trim();
      if (!v) return null;
      return { sig: v, kind: "typed" as const };
    }
    if (!hasInk || !canvasRef.current) return null;
    return { sig: canvasRef.current.toDataURL("image/png"), kind: "drawn" as const };
  };

  const onSign = () => {
    const name = signer.trim();
    if (!name) return toast.error("Enter your name to sign");
    const undecided = open.filter((p) => !decisions[p.id]);
    if (undecided.length > 0) return toast.error("Decide on every proposal first");
    const s = collectSignature();
    if (!s) return toast.error(mode === "type" ? "Type your signature" : "Draw your signature");
    const actions = open.map((p) => ({ proposal_id: p.id, action: decisions[p.id]! }));
    approveH4(name, s.sig, s.kind, actions);
    const promoted = actions.filter((a) => a.action === "promote").length;
    toast.success(`H4 signed · ${promoted} skill(s) promoted`);
  };

  return (
    <div className="border-l-4 border-primary -ml-px">
      <div className="p-5 space-y-4">
        <div>
          <div className="text-xs flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-primary pulse-red" />
            <span className="font-mono text-muted-foreground">H4 · Campaign Strategist</span>
          </div>
          <h2 className="text-lg font-semibold">Insights & Skill Promotion</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Insights found {open.length} pattern{open.length === 1 ? "" : "s"} worth promoting. Promote what should compound into future runs.
          </p>
        </div>

        <div className="space-y-3">
          {open.map((p) => (
            <div key={p.id} className="rounded-md border border-accent/30 bg-card p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold flex items-center gap-1.5">
                    <Sparkles className="w-3 h-3 text-accent" /> {p.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.type} · {p.scope} · confidence {p.confidence}
                  </div>
                </div>
                {p.warning && (
                  <span className="text-[10px] text-warning flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                  </span>
                )}
              </div>
              <p className="text-xs text-foreground/85 leading-snug">{p.pattern}</p>
              <div className="text-[10px] text-muted-foreground">
                Projected impact:{" "}
                <span className="text-success font-mono">${p.impact.cost_delta_usd.toFixed(2)} cost</span>,{" "}
                <span className="text-success font-mono">+{(p.impact.quality_delta * 100).toFixed(0)}% quality</span>
              </div>
              {p.warning && <p className="text-[10px] text-warning">⚠ {p.warning}</p>}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant={decisions[p.id] === "promote" ? "default" : "outline"}
                  className={cn("flex-1 h-8 text-xs", decisions[p.id] === "promote" && "bg-success hover:bg-success/90")}
                  onClick={() => setAction(p.id, "promote")}
                >
                  <Check className="w-3 h-3 mr-1" /> Promote
                </Button>
                <Button
                  size="sm"
                  variant={decisions[p.id] === "reject" ? "default" : "outline"}
                  className={cn("flex-1 h-8 text-xs", decisions[p.id] === "reject" && "bg-muted text-foreground")}
                  onClick={() => setAction(p.id, "reject")}
                >
                  <XIcon className="w-3 h-3 mr-1" /> Reject
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 pt-2 border-t border-border">
          <div className="space-y-1.5">
            <Label htmlFor="h4-signer" className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Signer name
            </Label>
            <Input
              id="h4-signer"
              value={signer}
              onChange={(e) => setSigner(e.target.value)}
              placeholder="e.g. Alex — Campaign Strategist"
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
                  <TypeIcon className="w-3 h-3" /> Type
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

        <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" onClick={onSign}>
          Sign & Close Campaign
        </Button>
      </div>
    </div>
  );
}
