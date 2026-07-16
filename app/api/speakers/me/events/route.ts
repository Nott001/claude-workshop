import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: dbUser, error: userErr } = await supabase
    .from("USERS")
    .select("user_id")
    .eq("clerk_id", userId)
    .single();

  if (userErr || !dbUser) {
    console.error("[speaker-events] user lookup failed:", userErr?.message ?? "not found", userId);
    return NextResponse.json([]);
  }

  const { data: profile, error: profileErr } = await supabase
    .from("SPEAKER_PROFILES")
    .select("speaker_profile_id")
    .eq("user_id", dbUser.user_id)
    .single();

  if (profileErr || !profile) {
    console.error("[speaker-events] no speaker profile for user:", dbUser.user_id, profileErr?.message);
    return NextResponse.json([]);
  }

  const { data: assignments, error: assignErr } = await supabase
    .from("EVENT_SPEAKERS")
    .select("event_id")
    .eq("speaker_profile_id", profile.speaker_profile_id);

  if (assignErr) {
    console.error("[speaker-events] assignment query failed:", assignErr.message);
    return NextResponse.json([]);
  }

  if (!assignments || assignments.length === 0) {
    return NextResponse.json([]);
  }

  const eventIds = assignments.map((a) => a.event_id);

  const { data: events, error } = await supabase
    .from("EVENTS")
    .select("*, COURSE(course_name)")
    .in("event_id", eventIds)
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[speaker-events] events query failed:", error.message);
    return NextResponse.json([]);
  }

  const mapped = (events ?? []).map((e) => ({
    event_id: e.event_id,
    title: e.title,
    event_date: e.event_date,
    start_time: e.start_time,
    end_time: e.end_time,
    venue_name: e.venue_name,
    status: e.status,
    course_name: e.COURSE?.course_name ?? null,
  }));

  return NextResponse.json(mapped);
}
