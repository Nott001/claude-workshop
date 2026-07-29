import type { AuthUser } from "@/modules/auth";
import type { EventWithCourse, EventSpeakerEntry } from "@/modules/events/lib/types";

export interface EventAccessData {
  event: EventWithCourse | null;
  hasTicket: boolean;
  isSpeakerAssigned: boolean;
  speakerProfileId: number | null;
  userId: number;
  userRole: string;
}

export async function fetchEventAccess(eventId: string, user: AuthUser): Promise<EventAccessData> {
  const role = user.role;

  const [eventRes, speakerRes, ticketRes] = await Promise.all([
    fetch(`/api/events/${eventId}`),
    role === "speaker" ? fetch("/api/speakers/me") : Promise.resolve(null),
    role !== "facilitator" && role !== "speaker" ? fetch("/api/tickets") : Promise.resolve(null),
  ]);

  const event: EventWithCourse | null = eventRes.ok ? await eventRes.json() : null;

  let hasTicket = false;
  let speakerProfileId: number | null = null;
  let isSpeakerAssigned = false;

  if (speakerRes) {
    const speakerData = speakerRes.ok ? await speakerRes.json() : null;
    speakerProfileId = speakerData?.id ?? null;
    isSpeakerAssigned =
      !!speakerProfileId &&
      (event?.EVENT_SPEAKER?.some((es: EventSpeakerEntry) => es.SPEAKER_PROFILE.id === speakerProfileId) ?? false);
  }

  if (ticketRes) {
    const tickets = ticketRes.ok ? await ticketRes.json() : [];
    hasTicket = tickets.some(
      (t: { event_id: number; status: string }) => t.event_id === Number(eventId) && t.status !== "cancelled",
    );
  }

  return {
    event,
    hasTicket,
    isSpeakerAssigned,
    speakerProfileId,
    userId: user.id,
    userRole: role,
  };
}
