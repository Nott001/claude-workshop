import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { isEventFinished, isEventStarted } from "@/shared/lib/date-utils";
import { getServiceClient } from "@/shared/db/client";
import { readAfterEventModules, resolveCourseGrant } from "@/modules/courses/lib/course-entitlement";
import { releaseFor, visibleModules } from "@/modules/courses/lib/after-event-modules";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import * as eventDao from "@/modules/events/db/event.dao";

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const course = await courseDao.findCourseWithDetails(supabase, Number(courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // The room admits ticket holders, assigned speakers and staff; the feed must
  // honour the same gate. A role check alone kept the room empty for the
  // attendees it let in.
  const grant = await resolveCourseGrant(supabase, user, course.id);
  if (!grant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await eventDao.findByIdWithCourse(supabase, course.event_id);

  // The ticket and speaker facts are computed here, against the exact event,
  // so a caller's eligibility never depends on how many rows their own ticket
  // listing returns.
  let hasTicket = false;
  let speakerProfileId: number | null = null;
  let isSpeakerAssigned = false;
  if (event) {
    const [ticket, speakerProfile] = await Promise.all([
      ticketDao.findActiveTicketByUserAndEvent(supabase, user.id, event.id),
      speakerDao.findByUserId(supabase, user.id),
    ]);
    hasTicket = !!ticket;
    speakerProfileId = speakerProfile?.id ?? null;
    if (speakerProfileId !== null) {
      isSpeakerAssigned = await speakerDao.checkSpeakerAssignment(supabase, speakerProfileId, event.id);
    }

    // The room stays shut to the audience until the event starts. Staff set
    // it up and assigned speakers run it, but a ticket holder must not
    // receive the curriculum early — so the course is withheld from the
    // response rather than refused outright, letting the page show the lock
    // with the event's own opening window.
    const isStaff = hasMinRole(user.role, ROLES.FACILITATOR);
    if (!isEventStarted(event.event_date, event.start_time) && !isStaff && !isSpeakerAssigned) {
      return NextResponse.json({ course: null, event, hasTicket, isSpeakerAssigned, speakerProfileId });
    }

    // Modules held back for after the event are stripped here rather than
    // hidden in the page: material withheld by a component is still on the
    // wire, and the room is the surface people already have open when the
    // session ends.
    const map = await readAfterEventModules(supabase);
    course.MODULE = visibleModules(course.MODULE, releaseFor(map, event.id), {
      started: true,
      finished: isEventFinished(event.event_date, event.end_time),
      isStaff: isStaff || isSpeakerAssigned,
    });
  }

  return NextResponse.json({ course, event, hasTicket, isSpeakerAssigned, speakerProfileId });
}
