// force local-timezone parsing — bare "2024-01-15" is parsed as UTC midnight,
// which shifts to the previous day in negative UTC offset timezones
export function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}

/**
 * A local-time Date for an event window edge. Times arrive unpadded ("9:00"),
 * which the ISO parse rejects, so hours and minutes are zero-padded before
 * parsing; a falsy or unparseable input yields null so callers can branch
 * instead of comparing against Invalid Date.
 */
export function parseLocalDateTime(dateStr: string, timeStr: string): Date | null {
  if (!dateStr || !timeStr) return null;
  const [hours, minutes = "00", seconds = "00"] = timeStr.split(":");
  const padded = `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:${seconds.padStart(2, "0")}`;
  const d = new Date(`${dateStr}T${padded}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isEventLive(eventDate: string, startTime: string, endTime: string): boolean {
  const now = new Date();
  const [y, m, d] = eventDate.split("-").map(Number);
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = new Date(y, m - 1, d, sh, sm);
  const end = new Date(y, m - 1, d, eh, em);
  return now >= start && now <= end;
}

// Follows the local-time convention of isEventLive: an event has ended the
// moment its end time is in the past, which is what marks it completed.
// Missing or unparseable edge values mean "not finished", so callers like the
// registration guard and survey sender refuse to act on incomplete rows
// instead of crashing on them.
export function isEventFinished(eventDate: string, endTime: string): boolean {
  const now = new Date();
  const [y, m, d] = (eventDate ?? "").split("-").map(Number);
  const [eh, em] = (endTime ?? "").split(":").map(Number);
  const end = new Date(y, m - 1, d, eh, em);
  if (Number.isNaN(end.getTime())) return false;
  return now > end;
}

export function eventStatusLabel(status: string): string {
  switch (status) {
    case "active":
      return "Upcoming";
    case "draft":
      return "Draft";
    case "complete":
      return "Past";
    default:
      return status;
  }
}
