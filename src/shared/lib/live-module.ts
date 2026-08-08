import { parseLocalDateTime } from "@/shared/lib/date-utils";

export interface LiveModuleSource {
  id: number;
  module_name: string;
  start_time: string | null;
  end_time: string | null;
  SPEAKER_PROFILE?: { id: number; USER: { full_name: string } | null } | null;
}

export type SessionStatus = "completed" | "live" | "upcoming";

/**
 * Where a module's session sits relative to now, or null when the session
 * cannot be placed in time (no event date, a missing edge, or a time that
 * does not parse). Sessions are half-open [start, end), matching the overlap
 * rule in `scheduling.ts`, so the roadmap and the "live" pill never disagree.
 */
export function moduleSessionStatus(
  eventDate: string,
  startTime: string | null,
  endTime: string | null,
  now: Date,
): SessionStatus | null {
  if (!eventDate || !startTime || !endTime) return null;
  const start = parseLocalDateTime(eventDate, startTime);
  const end = parseLocalDateTime(eventDate, endTime);
  if (!start || !end) return null;
  const t = now.getTime();
  if (t < start.getTime()) return "upcoming";
  if (t < end.getTime()) return "live";
  return "completed";
}

/**
 * The module whose scheduled session is happening right now, or null when
 * none is.
 */
export function findLiveModule(
  modules: LiveModuleSource[],
  eventDate: string,
  now: Date = new Date(),
): LiveModuleSource | null {
  return modules.find((m) => moduleSessionStatus(eventDate, m.start_time, m.end_time, now) === "live") ?? null;
}
