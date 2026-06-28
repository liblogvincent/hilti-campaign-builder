import { Check, Loader2, AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LocalizedContent } from "@/types";

const MAP: Record<
  LocalizedContent["translationStatus"],
  { label: string; cls: string; Icon: typeof Check }
> = {
  complete: { label: "Complete", cls: "bg-success/15 text-success", Icon: Check },
  in_progress: { label: "In Progress", cls: "bg-primary/15 text-primary", Icon: Loader2 },
  needs_review: { label: "Needs Review", cls: "bg-warning/15 text-warning", Icon: AlertTriangle },
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground", Icon: Clock },
};

export function LocaleStatusBadge({
  status,
  className,
}: {
  status: LocalizedContent["translationStatus"];
  className?: string;
}) {
  const { label, cls, Icon } = MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium",
        cls,
        className,
      )}
    >
      <Icon className={cn("w-3 h-3", status === "in_progress" && "animate-spin")} />
      {label}
    </span>
  );
}
