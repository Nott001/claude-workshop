export interface LiveModuleSource {
  id: number;
  module_name: string;
  start_time: string | null;
  end_time: string | null;
  SPEAKER_PROFILE: { id: number; USER: { full_name: string } | null } | null;
}

function toDate(eventDate: string, time: string): Date | null {
  const date = new Date(`${eventDate}T${time}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * The module whose scheduled session is happening right now, or null when
 * none is. Sessions are half-open [start, end), matching the overlap rule in
 * `scheduling.ts`, and a module missing either edge can never be live.
 */
export function findLiveModule(
  modules: LiveModuleSource[],
  eventDate: string,
  now: Date = new Date(),
): LiveModuleSource | null {
  if (!eventDate) return null;
  return (
    modules.find((m) => {
      if (!m.start_time || !m.end_time) return false;
      const start = toDate(eventDate, m.start_time);
      const end = toDate(eventDate, m.end_time);
      if (!start || !end) return false;
      const t = now.getTime();
      return t >= start.getTime() && t < end.getTime();
    }) ?? null
  );
}
