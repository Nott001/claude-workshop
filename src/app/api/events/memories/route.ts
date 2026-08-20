import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";
import { listEventMemories, MEMORY_EVENT_LIMIT } from "@/modules/events/lib/event-service";

/**
 * The finished events on /community, each with the head of its photo archive.
 *
 * Its own endpoint rather than a widening of `/api/events` because it answers a
 * different question — "what is worth revisiting" rather than "what is on the
 * calendar" — and because the archive is the expensive half. Every other
 * listing would pay for the second query and render none of it.
 *
 * Anonymous like the page it feeds. The read is published-events-only and
 * carries no per-caller scoping, so there is nothing here a session would
 * change.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const requested = Number(searchParams.get("limit"));
  const limit = Number.isInteger(requested) && requested > 0 ? Math.min(requested, MEMORY_EVENT_LIMIT) : MEMORY_EVENT_LIMIT;

  const supabase = getServiceClient();
  const memories = await listEventMemories(supabase, limit);

  return NextResponse.json({ data: memories });
}
