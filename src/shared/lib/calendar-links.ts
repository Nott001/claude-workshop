export interface CalendarEventData {
  title: string;
  description?: string | null;
  location?: string | null;
  /** YYYY-MM-DD */
  date: string;
  /** HH:MM (unpadded allowed) */
  startTime: string;
  /** HH:MM (unpadded allowed) */
  endTime: string;
}

const pad2 = (n: string): string => n.padStart(2, "0");

/** Local "YYYYMMDDTHHMMSS" stamp for "YYYY-MM-DD" + "HH:MM[:SS]". */
function localStamp(date: string, time: string): string {
  const [h, m = "00", s = "00"] = time.split(":");
  return `${date.replaceAll("-", "")}T${pad2(h)}${pad2(m)}${pad2(s)}`;
}

/** Local "YYYY-MM-DDTHH:MM:SS" stamp for Outlook's startdt/enddt. */
function outlookStamp(date: string, time: string): string {
  const [h, m = "00", s = "00"] = time.split(":");
  return `${date}T${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}

/** RFC 3986 query string; empty values are omitted rather than sent blank. */
function queryString(entries: Array<[string, string]>): string {
  return entries
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join("&");
}

/**
 * No `Z` anywhere: the app already treats event times as local, and adding a
 * zone suffix would shift them in the calendar's own timezone.
 */
export function buildGoogleCalendarUrl(data: CalendarEventData): string {
  const query = queryString([
    ["action", "TEMPLATE"],
    ["text", data.title],
    ["dates", `${localStamp(data.date, data.startTime)}/${localStamp(data.date, data.endTime)}`],
    ["details", data.description ?? ""],
    ["location", data.location ?? ""],
  ]);
  return `https://calendar.google.com/calendar/render?${query}`;
}

export function buildOutlookCalendarUrl(data: CalendarEventData): string {
  const query = queryString([
    ["allday", "false"],
    ["subject", data.title],
    ["startdt", outlookStamp(data.date, data.startTime)],
    ["enddt", outlookStamp(data.date, data.endTime)],
    ["body", data.description ?? ""],
    ["location", data.location ?? ""],
  ]);
  return `https://outlook.live.com/calendar/0/action/compose?${query}`;
}

/** RFC 5545 content escaping: backslash, semicolon and comma are separators. */
function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/**
 * A data:text/calendar URI for an Apple/"Download .ics" action. UID and
 * DTSTAMP are derived from the event's own fields so the same event always
 * yields the same href — no hydration mismatch, stable tests.
 */
export function buildIcsHref(data: CalendarEventData): string {
  const start = localStamp(data.date, data.startTime);
  const end = localStamp(data.date, data.endTime);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//claude-workshop//Event//EN",
    "BEGIN:VEVENT",
    `UID:event-${start}@claude-workshop`,
    `DTSTAMP:${data.date.replaceAll("-", "")}T000000Z`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(data.title)}`,
    ...(data.description ? [`DESCRIPTION:${escapeIcs(data.description)}`] : []),
    ...(data.location ? [`LOCATION:${escapeIcs(data.location)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  const document = lines.join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(document)}`;
}
