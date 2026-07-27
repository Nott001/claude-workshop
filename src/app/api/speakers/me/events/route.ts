import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { userDao, speakerDao, eventDao } from "@/lib/db/dao";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const dbUser = await userDao.findByAuthId(supabase, userId);

  if (!dbUser) {
    return NextResponse.json([]);
  }

  const profile = await speakerDao.findByUserId(supabase, dbUser.id);

  if (!profile) {
    return NextResponse.json([]);
  }

  const eventIds = await speakerDao.getSpeakerEventIds(supabase, profile.id);

  if (eventIds.length === 0) {
    return NextResponse.json([]);
  }

  const events = await eventDao.findByIds(supabase, eventIds);

  const mapped = (events ?? []).map(
    (e: {
      id: number;
      title: string;
      event_date: string;
      start_time: string;
      end_time: string;
      venue_name: string;
      status: string;
      COURSE?: { course_name: string } | null;
    }) => ({
      event_id: e.id,
      title: e.title,
      event_date: e.event_date,
      start_time: e.start_time,
      end_time: e.end_time,
      venue_name: e.venue_name,
      status: e.status,
      course_name: e.COURSE?.course_name ?? null,
    }),
  );

  return NextResponse.json(mapped);
}
