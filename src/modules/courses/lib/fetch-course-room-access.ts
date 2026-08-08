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
 * The room's one feed round-trip: `/api/courses/[courseId]/room` returns the
 * course, its linked event and the ticket/speaker facts. Those facts are
 * derived server-side against the exact event, so the client does not page
 * through the caller's own ticket list to decide admission.
 */
export async function fetchCourseRoomAccess(courseId: string, user: AuthUser): Promise<CourseRoomAccessData> {
  const res = await fetch(`/api/courses/${courseId}/room`);
  const room = res.ok ? await res.json() : null;

  return {
    course: room?.course ?? null,
    event: room?.event ?? null,
    hasTicket: room?.hasTicket ?? false,
    isSpeakerAssigned: room?.isSpeakerAssigned ?? false,
    speakerProfileId: room?.speakerProfileId ?? null,
    userId: user.id,
    userRole: user.role,
  };
}
