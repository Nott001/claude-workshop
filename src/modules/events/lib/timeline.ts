import { moduleSessionStatus, type LiveModuleSource, type SessionStatus } from "@/shared/lib/live-module";
import { parseLocalDateTime } from "@/shared/lib/date-utils";

export interface ModuleEntry {
  kind: "module";
  module: LiveModuleSource;
  status: SessionStatus;
  position: number;
}

export interface BookendEntry {
  kind: "bookend";
  label: string;
  time: string;
  status: SessionStatus;
  position: number;
}

export type TimelineItem = ModuleEntry | BookendEntry;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function bookendStatus(eventDate: string, time: string, now: Date): SessionStatus | null {
  const point = parseLocalDateTime(eventDate, time);
  if (!point) return null;
  return now >= point ? "completed" : "upcoming";
}

/**
 * Position of an item within the event window, 0 at the start, 1 at the end.
 * Falls back to module-relative spacing when the event window is missing.
 */
function positionInWindow(eventDate: string, time: string, startMs: number, endMs: number): number {
  if (endMs <= startMs) return 0;
  const point = parseLocalDateTime(eventDate, time);
  if (!point) return 0;
  return Math.max(0, Math.min(1, (point.getTime() - startMs) / (endMs - startMs)));
}

/**
 * The full session roadmap: event start, every scheduled module in the order
 * it runs, event end — each tagged with where it sits in time and its
 * proportional position within the event window.
 */
export function buildTimeline(
  modules: LiveModuleSource[],
  eventDate: string,
  eventStartTime: string | null | undefined,
  eventEndTime: string | null | undefined,
  now: Date = new Date(),
): TimelineItem[] {
  if (!eventDate) return [];

  const parsedStart = eventStartTime ? parseLocalDateTime(eventDate, eventStartTime) : null;
  const parsedEnd = eventEndTime ? parseLocalDateTime(eventDate, eventEndTime) : null;

  const moduleEntries: ModuleEntry[] = modules
    .map((mod) => ({
      kind: "module" as const,
      module: mod,
      status: moduleSessionStatus(eventDate, mod.start_time, mod.end_time, now),
    }))
    .filter((entry): entry is ModuleEntry => entry.status !== null)
    .sort((a, b) => toMinutes(a.module.start_time!) - toMinutes(b.module.start_time!));

  if (moduleEntries.length === 0) {
    const startBookend =
      parsedStart && parsedEnd
        ? (() => {
            const status = bookendStatus(eventDate, eventStartTime!, now);
            return status
              ? { kind: "bookend" as const, label: "Event start", time: eventStartTime!, status, position: 0 }
              : null;
          })()
        : null;
    const endBookend =
      parsedStart && parsedEnd
        ? (() => {
            const status = bookendStatus(eventDate, eventEndTime!, now);
            return status ? { kind: "bookend" as const, label: "Event end", time: eventEndTime!, status, position: 1 } : null;
          })()
        : null;
    return [...(startBookend ? [startBookend] : []), ...(endBookend ? [endBookend] : [])];
  }

  let startMs: number;
  let endMs: number;

  if (parsedStart && parsedEnd) {
    startMs = parsedStart.getTime();
    endMs = parsedEnd.getTime();
  } else {
    const firstModTime = moduleEntries[0].module.start_time!;
    const lastModTime = moduleEntries[moduleEntries.length - 1].module.end_time!;
    startMs = parseLocalDateTime(eventDate, firstModTime)!.getTime();
    endMs = parseLocalDateTime(eventDate, lastModTime)!.getTime();
  }

  const startBookend =
    parsedStart && parsedEnd
      ? (() => {
          const status = bookendStatus(eventDate, eventStartTime!, now);
          return status ? { kind: "bookend" as const, label: "Event start", time: eventStartTime!, status, position: 0 } : null;
        })()
      : null;

  const endBookend =
    parsedStart && parsedEnd
      ? (() => {
          const status = bookendStatus(eventDate, eventEndTime!, now);
          return status ? { kind: "bookend" as const, label: "Event end", time: eventEndTime!, status, position: 1 } : null;
        })()
      : null;

  const positionedModules = moduleEntries.map((entry) => ({
    ...entry,
    position: positionInWindow(eventDate, entry.module.start_time!, startMs, endMs),
  }));

  return [...(startBookend ? [startBookend] : []), ...positionedModules, ...(endBookend ? [endBookend] : [])];
}
