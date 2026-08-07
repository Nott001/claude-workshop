import { formatTime } from "@/shared/lib/date-utils";

export interface TimeOption {
  value: string;
  minutes: number;
  label: string;
  disabled?: boolean;
}

const DEFAULT_START_MINUTES = 0;
const DEFAULT_END_MINUTES = 23 * 60 + 45;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function toClock(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function isOffGrid(time: string, step = 15): boolean {
  return toMinutes(time) % step !== 0;
}

export interface BuildTimeOptionsArgs {
  eventStart?: string | null;
  eventEnd?: string | null;
  step?: number;
  committed?: (string | null)[];
}

export function buildTimeOptions({ eventStart, eventEnd, step = 15, committed = [] }: BuildTimeOptionsArgs): TimeOption[] {
  const bounded =
    eventStart && eventEnd && toMinutes(eventEnd) >= toMinutes(eventStart)
      ? { start: toMinutes(eventStart), end: toMinutes(eventEnd) }
      : { start: DEFAULT_START_MINUTES, end: DEFAULT_END_MINUTES };

  const options: TimeOption[] = [];
  const seen = new Set<string>();
  for (let minutes = bounded.start; minutes <= bounded.end; minutes += step) {
    const value = toClock(minutes);
    seen.add(value);
    options.push({ value, minutes, label: formatTime(value) });
  }

  // The event end rarely lands on a step; keep it selectable so a module can
  // end exactly at the event's closing time.
  if (bounded.end % step !== 0) {
    const value = toClock(bounded.end);
    seen.add(value);
    options.push({ value, minutes: bounded.end, label: formatTime(value) });
  }

  // A committed time off the grid stays representable rather than being
  // silently rewritten to the nearest step.
  for (const time of committed) {
    if (!time) continue;
    const value = toClock(toMinutes(time));
    if (!seen.has(value)) {
      seen.add(value);
      options.push({ value, minutes: toMinutes(time), label: formatTime(value) });
    }
  }

  return options;
}
