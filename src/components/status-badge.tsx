import { cn } from "@/lib/utils";

export type EventStatus = "live" | "active" | "upcoming" | "completed" | "draft" | "pending";

interface StatusBadgeProps {
  status: EventStatus;
  label?: string;
  className?: string;
}

const STATUS_STYLES: Record<EventStatus, string> = {
  live: "bg-red-900/20 text-error",
  active: "bg-green-900/20 text-green-500",
  upcoming: "bg-blue-900/20 text-blue-400",
  completed: "bg-green-900/20 text-green-500",
  draft: "bg-surface text-muted-foreground",
  pending: "bg-yellow-900/20 text-yellow-500",
};

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide",
        STATUS_STYLES[status],
        className,
      )}
    >
      {status === "live" && <span className="size-1.5 rounded-full bg-current animate-pulse" />}
      {label || status}
    </span>
  );
}
