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
export function isEventFinished(eventDate: string, endTime: string): boolean {
  const now = new Date();
  const [y, m, d] = eventDate.split("-").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const end = new Date(y, m - 1, d, eh, em);
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
