import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Layers, BookOpen, BarChart3, Settings, PenLine } from "lucide-react";
import { useLuban } from "@/store/luban";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Home", icon: Home },
  { to: "/campaigns", label: "Campaigns", icon: Layers },
  { to: "/content", label: "Content", icon: PenLine },
  { to: "/skills", label: "Skills", icon: BookOpen },
  { to: "/eval", label: "Eval", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

const STATUS_COLOR: Record<string, string> = {
  Published: "bg-success/15 text-success",
  "In Progress": "bg-primary/15 text-primary",
  "Awaiting Review": "bg-warning/15 text-warning",
  Planned: "bg-muted text-muted-foreground",
};

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const campaigns = useLuban((s) => s.campaigns);

  return (
    <aside className="w-[220px] shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
      <div className="px-5 pt-5 pb-6">
        <Link to="/" className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight" style={{ color: "#D2051E" }}>
            Luban
          </span>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            for Hilti
          </span>
        </Link>
        <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          Agentic End2End Engine
        </div>
      </div>


      <nav className="px-2 space-y-0.5">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm border-l-2 transition-colors",
                active
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40",
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 px-4">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
          Campaigns
        </div>
        <div className="space-y-1">
          {campaigns.map((c) => (
            <Link
              key={c.id}
              to="/campaign/$id"
              params={{ id: c.id }}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md hover:bg-muted/40 group"
            >
              <span className="text-xs text-foreground/80 truncate group-hover:text-foreground">
                {shortName(c.name)}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[9px] px-1.5 py-0.5 rounded-full font-medium",
                  STATUS_COLOR[c.status],
                )}
              >
                {c.status === "In Progress" ? "Live" : c.status === "Awaiting Review" ? "Hold" : c.status === "Published" ? "✓" : "·"}
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-auto px-4 py-4 text-[10px] text-muted-foreground border-t border-sidebar-border">
        Prototype · v0.1
      </div>
    </aside>
  );
}

function shortName(name: string): string {
  // "Q4 Power Tool Launch — Professional Contractor Segment" → "Q4 Power Tool"
  const head = name.split("—")[0].trim();
  const words = head.split(" ");
  return words.slice(0, 3).join(" ");
}
