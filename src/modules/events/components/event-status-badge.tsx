import { eventStatusLabel, isEventLive } from "@/shared/lib/date-utils";

interface EventStatusBadgeProps {
  status: string;
  date: string;
  startTime: string;
  endTime: string;
}

const STATUS_ICONS: Record<string, string> = {
  active: "auto_awesome",
  complete: "check_circle",
  draft: "edit_note",
};

export function EventStatusBadge({ status, date, startTime, endTime }: EventStatusBadgeProps) {
  if (isEventLive(date, startTime, endTime)) {
    return (
      <span className="relative inline-flex items-center gap-1.5 rounded-full bg-error px-3 py-1 text-xs font-semibold">
        <span className="size-1.5 rounded-full bg-surface animate-pulse" />
        Live
      </span>
    );
  }

  return (
    <span className="relative inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
      <span className="material-symbols-rounded text-sm">{STATUS_ICONS[status] ?? "auto_awesome"}</span>{" "}
      {eventStatusLabel(status)}
    </span>
  );
}
