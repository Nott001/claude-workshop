export interface ScheduleSource {
  module_name: string;
  start_time: string | null;
  end_time: string | null;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Every pair of modules whose sessions overlap. A session is half-open
 * [start, end): adjacent windows do not overlap, so "09:00-10:00" and
 * "10:00-12:00" pass. Modules missing either time are skipped.
 */
export function findTimeOverlaps<T extends ScheduleSource>(modules: T[]): [T, T][] {
  const sessions = modules
    .filter((m) => m.start_time !== null && m.end_time !== null)
    .map((m) => ({ module: m, start: toMinutes(m.start_time!), end: toMinutes(m.end_time!) }));

  const pairs: [T, T][] = [];
  for (let i = 0; i < sessions.length; i++) {
    for (let j = i + 1; j < sessions.length; j++) {
      const a = sessions[i];
      const b = sessions[j];
      if (a.start < b.end && b.start < a.end) {
        pairs.push([a.module, b.module]);
      }
    }
  }
  return pairs;
}
