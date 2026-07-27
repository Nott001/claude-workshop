import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { userDao, speakerDao, eventDao, ticketDao } from "@/lib/db/dao";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const dbUser = await userDao.findByAuthId(supabase, userId);

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = await speakerDao.findByUserId(supabase, dbUser.id);

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
    course_name: event.COURSE?.course_name ?? null,
    description: event.description ?? null,
    attendee_count: attendeeCount,
  });
}
