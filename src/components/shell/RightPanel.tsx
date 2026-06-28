import { useLuban } from "@/store/luban";
import { Button } from "@/components/ui/button";
import { X, PanelRight, MessageSquare, Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HomePanel } from "@/components/panels/HomePanel";
import { NodeDetailPanel } from "@/components/panels/NodeDetailPanel";
import { GatePanel, useGateConfig } from "@/components/panels/GatePanel";
import { H4InsightsPanel } from "@/components/panels/H4InsightsPanel";

const GATE_BY_TAB: Record<string, "H1" | "H2" | "H3" | "H4"> = {
  h1: "H1", h2: "H2", h3: "H3", h4: "H4",
};

export function RightPanel() {
  const tabs = useLuban((s) => s.panelTabs);
  const activeId = useLuban((s) => s.activeTabId);
  const setActive = useLuban((s) => s.setActiveTab);
  const closeTab = useLuban((s) => s.closeTab);
  const layout = useLuban((s) => s.layout);
  const setLayout = useLuban((s) => s.setLayout);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center border-b border-border bg-card px-1 h-10 shrink-0">
        <div className="flex-1 flex items-center overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={cn(
                "group flex items-center gap-1.5 px-3 h-10 text-xs whitespace-nowrap border-b-2 -mb-px",
                activeId === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="truncate max-w-[120px]">{t.label}</span>
              {t.kind !== "home" && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive"
                >
                  <X className="w-3 h-3" />
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 pr-1">
          <Button size="icon" variant={layout === "chat" ? "default" : "ghost"} className="h-7 w-7" onClick={() => setLayout("chat")} title="Chat only">
            <MessageSquare className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant={layout === "both" ? "default" : "ghost"} className="h-7 w-7" onClick={() => setLayout("both")} title="Both">
            <Columns2 className="w-3.5 h-3.5" />
          </Button>
          <Button size="icon" variant={layout === "panel" ? "default" : "ghost"} className="h-7 w-7" onClick={() => setLayout("panel")} title="Panel only">
            <PanelRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {active?.kind === "home" && <HomePanel />}
        {active?.kind === "node" && <NodeDetailPanel nodeId={active.id} />}
        {active?.kind === "gate" && <GateOrH4 tabId={active.id} />}
      </div>
    </div>
  );
}

function GateOrH4({ tabId }: { tabId: string }) {
  const gate = GATE_BY_TAB[tabId] ?? "H1";
  const config = useGateConfig(gate);
  if (gate === "H4") return <H4InsightsPanel />;
  if (!config) return <div className="p-5 text-muted-foreground">Gate not found.</div>;
  return <GatePanel config={config} />;
}
