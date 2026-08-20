import { appTimeZone, zonedFields, zonedInstant } from "@/shared/lib/app-timezone";

/**
 * An event date rendered in the zone the event is run in, so the server and
 * the browser print the same day. A bare "2024-01-15" parses as UTC midnight,
 * which is the previous day at any negative offset.
 */
export function formatEventDate(dateStr: string): string {
  const d = parseEventDateTime(dateStr, "00:00");
  if (!d) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: appTimeZone() });
}

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * The instant an event window edge falls on, read in the app timezone rather
 * than whichever zone the runtime happens to sit in — see `app-timezone.ts`
 * for why that distinction decides gates. Times arrive unpadded ("9:00"), and
 * a falsy or unparseable input yields null so callers can branch instead of
 * comparing against Invalid Date.
 */
export function parseEventDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const [year, month, day] = dateStr.split("-").map(Number);
  const [hour, minute = 0, second = 0] = timeStr.split(":").map(Number);
  const fields = { year, month, day, hour, minute, second };
  if (Object.values(fields).some((value) => !Number.isFinite(value))) return null;
  // Date.UTC rolls "2026-13-01" forward into the next year rather than
  // rejecting it, so the calendar is checked before the offset maths runs.
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  return zonedInstant(fields);
}

/**
 * Whether the event's opening edge has passed. Missing or unparseable window
 * edges mean "not started", so gates refuse on incomplete rows instead of
 * letting a ticket holder into a room that cannot be timed.
 */
export function isEventStarted(eventDate: string | null | undefined, startTime: string | null | undefined): boolean {
  const start = parseEventDateTime(eventDate ?? "", startTime ?? "");
  return !!start && start <= new Date();
}

export function isEventLive(eventDate: string, startTime: string, endTime: string): boolean {
  const start = parseEventDateTime(eventDate, startTime);
  const end = parseEventDateTime(eventDate, endTime);
  if (!start || !end) return false;
  const now = new Date();
  return now >= start && now <= end;
}

/**
 * Whether the event's closing edge has passed — what marks it completed, and
 * what releases the courses an event unlocks afterwards. Missing or
 * unparseable edge values mean "not finished", so callers like the
 * registration guard and the survey sender refuse to act on incomplete rows
 * instead of crashing on them.
 */
export function isEventFinished(eventDate: string, endTime: string): boolean {
  const end = parseEventDateTime(eventDate ?? "", endTime ?? "");
  return !!end && new Date() > end;
}

export function eventStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Upcoming";
    case "draft":
      return "Draft";
    case "complete":
      return "Completed";
    default:
      return status;
  }
}

/**
 * "Today" in the app timezone, in the same YYYY-MM-DD form EVENT.event_date is
 * stored in. Unlike `toISOString().split("T")[0]` this stays on the calendar
 * the events are scheduled against, so a date bound derived here agrees with
 * isEventFinished.
 */
export function eventZoneDate(now: Date = new Date()): string {
  const { year, month, day } = zonedFields(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * "Now" in the app timezone, in the HH:MM:SS form EVENT.end_time is stored in,
 * for comparing against the end edge of today's events.
 */
export function eventZoneTime(now: Date = new Date()): string {
  const { hour, minute, second } = zonedFields(now);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}
