import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, loadEventOr403, setMeetingLink } from "@/modules/events/lib/event-service";
import { meetingUrlSchema } from "@/modules/events/lib/schemas";

/**
 * The one event column an assigned facilitator may write.
 *
 * Its own route rather than a branch inside PATCH /api/events/[id], because the
 * two answer to different capabilities: that one is admin-only by design, and
 * widening it to let a facilitator set a link would have handed them the price
 * and the date with it.
 */
const bodySchema = z.object({ meeting_url: meetingUrlSchema });

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await loadEventOr403(supabase, Number(id), user, "meeting_link");
    const event = await setMeetingLink(supabase, Number(id), parsed.data.meeting_url, { id: user.id });
    return NextResponse.json({ meeting_url: event.meeting_url });
  } catch (err) {
    if (err instanceof EventServiceError) {
      if (err.status === 404 || err.status === 403) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      return NextResponse.json({ error: { message: err.message } }, { status: err.status });
    }
    throw err;
  }
}
