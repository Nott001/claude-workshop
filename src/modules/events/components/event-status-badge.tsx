import { eventStatusLabel, isEventLive } from "@/shared/lib/date-utils";

interface EventStatusBadgeProps {
  status: string;
  date: string;
  startTime: string;
  endTime: string;
}

export function EventStatusBadge({ status, date, startTime, endTime }: EventStatusBadgeProps) {
  if (isEventLive(date, startTime, endTime)) {
    return (
      <span className="relative inline-flex items-center gap-1.5 rounded-full bg-error px-3 py-1 text-xs font-semibold">
        <span className="size-1.5 rounded-full bg-surface animate-pulse" />
        Live
      </span>
    );
  }

  const label = eventStatusLabel(status);
  const icon = status === "complete" ? "check_circle" : "auto_awesome";

  return (
    <span className="relative inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
      <span aria-hidden className="material-symbols-rounded text-sm">
        {icon}
      </span>{" "}
      {label}
    </span>
  );
}
