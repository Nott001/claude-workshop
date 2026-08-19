import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { loadEventOr403, setMeetingLink } from "@/modules/events/lib/event-service";
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

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await loadEventOr403(supabase, Number(id), guard.user, "meeting_link");
    const event = await setMeetingLink(supabase, Number(id), parsed.data.meeting_url, { id: guard.user.id });
    return NextResponse.json({ meeting_url: event.meeting_url });
  } catch (err) {
    return toErrorResponse(err);
  }
}
