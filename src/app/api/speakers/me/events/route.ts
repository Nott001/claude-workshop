import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { speakerDao, eventDao } from "@/lib/db/dao";

export async function GET() {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json([]);
  }

  const profile = await speakerDao.findByUserId(supabase, user.id);

  if (!profile) {
    return NextResponse.json([]);
  }

  const eventIds = await speakerDao.getSpeakerEventIds(supabase, profile.id);

  if (eventIds.length === 0) {
    return NextResponse.json([]);
  }

  const events = await eventDao.findByIds(supabase, eventIds);

  const mapped = events.map((e) => ({
    event_id: e.id,
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
