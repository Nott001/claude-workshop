import { getServiceClient } from "@/lib/db";
import { eventDao } from "@/lib/db/dao";

export interface LandingEvent {
  event_id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  venue_name: string;
  status: string;
  course_name: string | null;
  cover_image_url: string | null;
}

const ACCENT_CLASSES = [
  "from-sky-500 via-cyan-400 to-teal-300",
  "from-blue-700 via-sky-500 to-cyan-300",
  "from-indigo-600 via-blue-500 to-cyan-400",
  "from-sky-600 via-cyan-500 to-emerald-400",
];

export function accentClass(index: number): string {
  return ACCENT_CLASSES[index % ACCENT_CLASSES.length];
}

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
  const start = new Date(`${eventDate}T${startTime}`);
  const end = new Date(`${eventDate}T${endTime}`);
  return now >= start && now <= end;
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

export async function getUpcomingEvents(): Promise<LandingEvent[]> {
  const supabase = getServiceClient();
  const data = await eventDao.getUpcomingForLanding(supabase);

  return data.map((e) => ({
    event_id: e.id,
    title: e.title,
    event_date: e.event_date,
    start_time: e.start_time,
    end_time: e.end_time,
    venue_name: e.venue_name,
    status: e.status,
    course_name: e.COURSE?.course_name ?? null,
    cover_image_url: e.cover_image_url ?? null,
  }));
}
