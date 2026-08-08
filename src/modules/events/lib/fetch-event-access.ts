import { ROLES } from "@/shared/lib/roles";
import type { AuthUser } from "@/modules/auth/lib/types";
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
    // /api/auth/me carries the caller's own speaker_profile_id; a speaker is
    // just a user, so there is no separate /api/speakers/me profile route.
    role === ROLES.SPEAKER ? fetch("/api/auth/me") : Promise.resolve(null),
    role !== ROLES.FACILITATOR && role !== ROLES.SPEAKER ? fetch("/api/tickets") : Promise.resolve(null),
  ]);

  const [event, speakerData, tickets] = await Promise.all([
    eventRes.ok ? eventRes.json() : Promise.resolve(null),
    speakerRes?.ok ? speakerRes.json() : Promise.resolve(null),
    ticketRes?.ok ? ticketRes.json() : Promise.resolve([]),
  ]);

  const speakerProfileId: number | null = speakerData?.speaker_profile_id ?? null;
  const isSpeakerAssigned =
    !!speakerProfileId &&
    (event?.EVENT_SPEAKER?.some((es: EventSpeakerEntry) => es.SPEAKER_PROFILE.id === speakerProfileId) ?? false);

  const hasTicket = (tickets as Array<{ event_id: number; status: string }>).some(
    (t) => t.event_id === Number(eventId) && t.status !== "cancelled",
  );

  return {
    event,
    hasTicket,
    isSpeakerAssigned,
    speakerProfileId,
    userId: user.id,
    userRole: role,
  };
}
