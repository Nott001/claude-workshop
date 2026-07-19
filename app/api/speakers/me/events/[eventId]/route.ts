import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: dbUser, error: userErr } = await supabase.from("USERS").select("user_id").eq("clerk_id", userId).single();

  if (userErr || !dbUser) {
    console.error("[speaker-event-detail] user lookup failed:", userErr?.message, userId);
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: profile, error: profileErr } = await supabase
    .from("SPEAKER_PROFILES")
    .select("speaker_profile_id")
    .eq("user_id", dbUser.user_id)
    .single();

  if (profileErr || !profile) {
    console.error("[speaker-event-detail] no speaker profile:", dbUser.user_id);
    return NextResponse.json({ error: "Not a speaker" }, { status: 403 });
  }

  const { data: assignment } = await supabase
    .from("EVENT_SPEAKERS")
    .select("event_id")
    .eq("speaker_profile_id", profile.speaker_profile_id)
    .eq("event_id", Number(eventId))
    .single();

  if (!assignment) {
    console.error("[speaker-event-detail] not assigned:", profile.speaker_profile_id, eventId);
    return NextResponse.json({ error: "Not assigned to this event" }, { status: 403 });
  }

  const { data: event, error: eventErr } = await supabase
    .from("EVENTS")
    .select("*, COURSE(course_name)")
    .eq("event_id", Number(eventId))
    .single();

  if (eventErr || !event) {
    console.error("[speaker-event-detail] event not found:", eventId, eventErr?.message);
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { count: attendeeCount } = await supabase
    .from("TICKETS")
    .select("ticket_id", { count: "exact", head: true })
    .eq("event_id", Number(eventId))
    .eq("status", "active");

  return NextResponse.json({
    event_id: event.event_id,
    title: event.title,
    event_date: event.event_date,
    start_time: event.start_time,
    end_time: event.end_time,
    venue_name: event.venue_name,
    status: event.status,
    course_name: event.COURSE?.course_name ?? null,
    description: event.description ?? null,
    attendee_count: attendeeCount ?? 0,
  });
}
