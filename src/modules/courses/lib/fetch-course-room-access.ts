import { ROLES } from "@/shared/lib/roles";
import type { AuthUser } from "@/modules/auth/lib/types";
import type { ModuleWithLessons } from "@/modules/courses/lib/types";

export interface CourseRoomEventSpeaker {
  SPEAKER_PROFILE: { id: number };
}

export interface CourseRoomEvent {
  id: number;
  title: string;
  event_date: string;
  start_time: string;
  end_time: string;
  price: number;
  currency: string;
  status: string;
  COURSE: { id: number; course_name: string; course_description: string | null } | null;
  EVENT_SPEAKER: CourseRoomEventSpeaker[];
}

export interface CourseRoomCourse {
  id: number;
  course_name: string;
  course_description: string | null;
  MODULE: ModuleWithLessons[];
}

export interface CourseRoomData {
  course: CourseRoomCourse | null;
  event: CourseRoomEvent | null;
}

export interface CourseRoomAccessData extends CourseRoomData {
  hasTicket: boolean;
  isSpeakerAssigned: boolean;
  speakerProfileId: number | null;
  userId: number;
  userRole: string;
}

/**
 * The room's one feed round-trip: `/api/courses/[courseId]/room` returns both
 * the course and its linked event, and the speaker/ticket facts are derived
 * against the event — tickets and assignment are event-scoped, while the room
 * itself is course-keyed.
 */
export async function fetchCourseRoomAccess(courseId: string, user: AuthUser): Promise<CourseRoomAccessData> {
  const role = user.role;

  const [roomRes, speakerRes, ticketRes] = await Promise.all([
    fetch(`/api/courses/${courseId}/room`),
    // /api/auth/me carries the caller's own speaker_profile_id; a speaker is
    // just a user, so there is no separate /api/speakers/me profile route.
    role === ROLES.SPEAKER ? fetch("/api/auth/me") : Promise.resolve(null),
    role !== ROLES.FACILITATOR && role !== ROLES.SPEAKER ? fetch("/api/tickets") : Promise.resolve(null),
  ]);

  const [room, speakerData, tickets] = await Promise.all([
    roomRes.ok ? roomRes.json() : Promise.resolve(null),
    speakerRes?.ok ? speakerRes.json() : Promise.resolve(null),
    ticketRes?.ok ? ticketRes.json() : Promise.resolve({ data: [] }),
  ]);

  const eventId = room?.event?.id;
  const speakerProfileId: number | null = speakerData?.speaker_profile_id ?? null;
  const isSpeakerAssigned =
    !!speakerProfileId &&
    (room?.event?.EVENT_SPEAKER?.some((es: CourseRoomEventSpeaker) => es.SPEAKER_PROFILE.id === speakerProfileId) ?? false);

  const hasTicket = ((tickets?.data ?? []) as Array<{ event_id: number; status: string }>).some(
    (t) => t.event_id === eventId && t.status !== "cancelled",
  );

  return {
    course: room?.course ?? null,
    event: room?.event ?? null,
    hasTicket,
    isSpeakerAssigned,
    speakerProfileId,
    userId: user.id,
    userRole: role,
  };
}
