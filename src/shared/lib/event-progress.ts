import { parseEventDateTime } from "@/shared/lib/date-utils";

/**
 * Overall event progress as a fraction 0–1: 0 before the event opens, 1 once
 * it has ended, linear in between. Missing or unparseable window edges read as
 * 0 so callers never paint a progress bar for an event that cannot be timed.
 * Shared by the room's hero and the session timeline so both bars agree.
 */
export function eventProgress(
  eventDate: string,
  startTime: string | null | undefined,
  endTime: string | null | undefined,
  now: Date,
): number {
  if (!startTime || !endTime) return 0;
  const start = parseEventDateTime(eventDate, startTime);
  const end = parseEventDateTime(eventDate, endTime);
  if (!start || !end || end.getTime() <= start.getTime()) return 0;
  const t = now.getTime();
  if (t < start.getTime()) return 0;
  if (t >= end.getTime()) return 1;
  return (t - start.getTime()) / (end.getTime() - start.getTime());
}
