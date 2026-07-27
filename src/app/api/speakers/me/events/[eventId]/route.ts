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
    event_id: (event as { id: number }).id,
    title: (event as { title: string }).title,
    event_date: (event as { event_date: string }).event_date,
    start_time: (event as { start_time: string }).start_time,
    end_time: (event as { end_time: string }).end_time,
    venue_name: (event as { venue_name: string }).venue_name,
    status: (event as { status: string }).status,
    course_name: (event as { COURSE?: { course_name: string } | null }).COURSE?.course_name ?? null,
    description: (event as { description?: string | null }).description ?? null,
    attendee_count: attendeeCount,
  });
}
