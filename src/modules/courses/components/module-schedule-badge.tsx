import { formatTime } from "@/shared/lib/date-utils";

interface ModuleScheduleBadgeProps {
  startTime: string | null;
  endTime: string | null;
  speakerName: string | null;
}

export function ModuleScheduleBadge({ startTime, endTime, speakerName }: ModuleScheduleBadgeProps) {
  if (!startTime || !endTime) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-fg">
      <span className="material-symbols-rounded text-[14px]">schedule</span>
      {formatTime(startTime)} – {formatTime(endTime)}
      {speakerName ? ` · ${speakerName}` : ""}
    </span>
  );
}
