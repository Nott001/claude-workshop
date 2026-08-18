import { parseLocalDateTime } from "@/shared/lib/date-utils";

export interface RoomCountdown {
  startsIn: string;
  elapsed: string;
  remaining: string;
  started: boolean;
  ended: boolean;
}

function formatDuration(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatStartsIn(start: Date, now: Date): string {
  const diff = start.getTime() - now.getTime();
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  const hms = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

/**
 * All per-second state the course-room navbar shows, derived from the event
 * window and one `now`. Purely functional so the ticking component keeps no
 * state it cannot already recompute.
 */
export function computeRoomCountdown(
  eventDate: string,
  startTime: string,
  endTime: string | null | undefined,
  now: Date,
): RoomCountdown {
  const start = parseLocalDateTime(eventDate, startTime);
  if (!start) {
    return { startsIn: "", elapsed: "00:00:00", remaining: "--:--:--", started: false, ended: false };
  }

  const end = endTime ? parseLocalDateTime(eventDate, endTime) : null;
  const started = now.getTime() >= start.getTime();
  const ended = !!end && now.getTime() >= end.getTime();

  if (ended && end) {
    return {
      startsIn: "",
      elapsed: formatDuration(Math.max(0, end.getTime() - start.getTime())),
      remaining: "00:00:00",
      started: true,
      ended: true,
    };
  }

  return {
    startsIn: started ? "" : formatStartsIn(start, now),
    elapsed: started ? formatDuration(now.getTime() - start.getTime()) : "00:00:00",
    remaining: end ? formatDuration(end.getTime() - now.getTime()) : "--:--:--",
    started,
    ended: false,
  };
}
