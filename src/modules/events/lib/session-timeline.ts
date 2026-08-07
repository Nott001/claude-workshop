import { moduleSessionStatus, type LiveModuleSource, type SessionStatus } from "@/modules/events/lib/live-module";

export interface TimelineEntry {
  module: LiveModuleSource;
  status: SessionStatus;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * The scheduled modules in the order they run, each tagged with where it sits
 * in time, for the room's side roadmap. Modules without a full session are
 * excluded: the roadmap shows where the event is in time, and a module with no
 * window has no place in it. Sessions are half-open, matching `live-module`.
 */
export function buildTimeline(modules: LiveModuleSource[], eventDate: string, now: Date = new Date()): TimelineEntry[] {
  return modules
    .map((module) => ({
      module,
      status: moduleSessionStatus(eventDate, module.start_time, module.end_time, now),
    }))
    .filter((entry): entry is TimelineEntry => entry.status !== null)
    .sort((a, b) => toMinutes(a.module.start_time!) - toMinutes(b.module.start_time!));
}
