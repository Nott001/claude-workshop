import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import * as eventDao from "@/modules/events/db/event.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const profile = await speakerDao.findByUserId(supabase, guard.user.id);

  if (!profile) {
    return NextResponse.json({ error: "Not a speaker" }, { status: 403 });
  }

  const isAssigned = await speakerDao.checkSpeakerAssignment(supabase, profile.id, Number(eventId));

  if (!isAssigned) {
    return NextResponse.json({ error: "Not assigned to this event" }, { status: 403 });
  }

  const event = await eventDao.findByIdWithCourseName(supabase, Number(eventId));

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const attendeeCount = await ticketDao.countByEvent(supabase, Number(eventId));

  return NextResponse.json({
    event_id: event.id,
    title: event.title,
    event_date: event.event_date,
    start_time: event.start_time,
    end_time: event.end_time,
    venue_name: event.venue_name,
    status: event.status,
    course_id: event.COURSE?.id ?? null,
    course_name: event.COURSE?.course_name ?? null,
    description: event.description ?? null,
    attendee_count: attendeeCount,
  });
}
