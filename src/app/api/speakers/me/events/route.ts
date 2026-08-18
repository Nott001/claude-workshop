import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import * as eventDao from "@/modules/events/db/event.dao";
import { toLandingEvent } from "@/modules/events/lib/landing-event";

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

  // A hand-rolled copy of toLandingEvent used to live here, and it silently
  // fell behind every column the shape gained — event_type most recently, so
  // an online engagement showed the onsite pin on its card.
  return NextResponse.json(events.map(toLandingEvent));
}
