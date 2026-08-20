import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import * as eventDao from "@/modules/events/db/event.dao";
import type { SpeakerEventFilter } from "@/modules/events/db/event.dao";
import { toLandingEvent } from "@/modules/events/lib/landing-event";

const FILTERS = new Set<SpeakerEventFilter>(["upcoming", "completed", "drafts"]);

function parseFilter(value: string | null): SpeakerEventFilter | null {
  return value !== null && FILTERS.has(value as SpeakerEventFilter) ? (value as SpeakerEventFilter) : null;
}

export async function GET(req: Request) {
  const supabase = getServiceClient();

  const { searchParams } = new URL(req.url);
  // An unknown value must not fall through to the full listing — a typo on a
  // per-user list would otherwise leak drafts and finished engagements.
  const filter = parseFilter(searchParams.get("filter"));
  if (filter === null && searchParams.has("filter")) {
    return NextResponse.json({ error: "Unknown filter" }, { status: 400 });
  }

  const user = await getCurrentUser(supabase);
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

  const events = await eventDao.findByIds(supabase, eventIds, { filter });

  // A hand-rolled copy of toLandingEvent used to live here, and it silently
  // fell behind every column the shape gained — event_type most recently, so
  // an online engagement showed the onsite pin on its card.
  return NextResponse.json(events.map(toLandingEvent));
}
