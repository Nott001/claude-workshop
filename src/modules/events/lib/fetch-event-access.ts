import type { AuthUser } from "@/modules/auth";
import { hasMinRole } from "@/shared/auth/role-hierarchy";

export interface EventAccessData {
  event: Record<string, unknown> | null;
  hasTicket: boolean;
  isSpeakerAssigned: boolean;
  speakerProfileId: number | null;
  userId: number;
  userRole: string;
}

export async function fetchEventAccess(eventId: string, user: AuthUser): Promise<EventAccessData> {
  const role = user.role;

  const eventRes = await fetch(`/api/events/${eventId}`);
  const event = eventRes.ok ? await eventRes.json() : null;

  let hasTicket = false;
  let speakerProfileId: number | null = null;
  let isSpeakerAssigned = false;

  if (role === "speaker") {
    const speakerRes = await fetch("/api/speakers/me");
    const speakerData = speakerRes.ok ? await speakerRes.json() : null;
    speakerProfileId = speakerData?.id ?? speakerData?.speaker_profile_id ?? null;
    isSpeakerAssigned =
      !!speakerProfileId &&
      event?.EVENT_SPEAKERS?.some(
        (es: { SPEAKER_PROFILES: { id?: number; speaker_profile_id?: number } }) =>
          es.SPEAKER_PROFILES.id === speakerProfileId || es.SPEAKER_PROFILES.speaker_profile_id === speakerProfileId,
      );
  } else if (!hasMinRole(role, "facilitator")) {
    const ticketRes = await fetch("/api/tickets");
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
