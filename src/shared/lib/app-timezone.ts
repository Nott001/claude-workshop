/**
 * The one timezone every event window is read in.
 *
 * EVENT stores a bare `date` and two `time` columns with no offset, so a wall
 * clock like "17:00" only means something once a zone is named. Reading it as
 * the *runtime's* local zone named two different ones: the browser answers with
 * the viewer's, while Workers has no local zone at all and answers UTC. A
 * UTC+8 event therefore ended eight hours late on the server while the client
 * had already moved on — the gates disagreed with the badges on the same page.
 *
 * Naming the zone here settles it for both halves. Override with
 * NEXT_PUBLIC_APP_TIMEZONE (a public var because the client gates read the same
 * clock); the default is where the events are run.
 */
const DEFAULT_TIME_ZONE = "Asia/Manila";

export function appTimeZone(): string {
  return process.env.NEXT_PUBLIC_APP_TIMEZONE || DEFAULT_TIME_ZONE;
}

// Constructing an Intl.DateTimeFormat is the expensive half of this file, and
// every gate calls through here on every render. One per zone, forever.
const formatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  formatters.set(timeZone, formatter);
  return formatter;
}

export interface ZonedFields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** The wall-clock reading an observer in `timeZone` takes off `instant`. */
export function zonedFields(instant: Date, timeZone: string = appTimeZone()): ZonedFields {
  const parts = partsFormatter(timeZone).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
    second: read("second"),
  };
}

function offsetMs(instant: Date, timeZone: string): number {
  const f = zonedFields(instant, timeZone);
  return Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second) - instant.getTime();
}

/**
 * The instant at which `timeZone` reads the given wall clock.
 *
 * The offset can only be looked up from an instant, and the instant is what we
 * are solving for, so the first guess is corrected once: on a DST boundary the
 * offset that applies before the shift is not the one that applies after it,
 * and a single pass would land an hour out. Zones without DST settle on the
 * first pass and the second changes nothing.
 */
export function zonedInstant(fields: ZonedFields, timeZone: string = appTimeZone()): Date {
  const wall = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
  const firstPass = wall - offsetMs(new Date(wall), timeZone);
  return new Date(wall - offsetMs(new Date(firstPass), timeZone));
}
