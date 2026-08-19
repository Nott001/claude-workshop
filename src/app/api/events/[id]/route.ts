import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { eventPartialSchema } from "@/modules/events/lib/schemas";
import { deleteEvent, getEvent, loadEventOr403, updateEvent } from "@/modules/events/lib/event-service";
import { canSeeMeetingLink, redactMeetingUrl } from "@/modules/events/lib/meeting-link";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { ROLES } from "@/shared/lib/roles";
import { badRequest } from "@/shared/lib/api-response";

// The 403/404s are answered with a bare string and the 400/500s with a nested
// { message }; keeping both shapes so the wire contract does not change. 403 is
// flat because the role guards this replaces answered "Forbidden" that way.

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await getCurrentUser(supabase);
  const userRole = user?.role ?? null;

  try {
    // The ticket and speaker lookups key on the id from the URL, not on
    // anything the event carries, so they no longer wait behind it. They also
    // have to be resolved before the response is built now, because whether the
    // meeting link may be served depends on the ticket.
    const [event, ticket, speakerProfile] = await Promise.all([
      getEvent(supabase, Number(id), { id: user?.id ?? null, role: userRole }),
      user ? ticketDao.findActiveTicketByUserAndEvent(supabase, user.id, Number(id)) : null,
      user ? speakerDao.findByUserId(supabase, user.id) : null,
    ]);

    const hasTicket = !!ticket;
    const speakerProfileId = speakerProfile?.id ?? null;
    const isSpeakerAssigned =
      speakerProfileId !== null ? await speakerDao.checkSpeakerAssignment(supabase, speakerProfileId, event.id) : false;

    // A meeting link is an unauthenticated door — anyone holding it walks in,
    // whether or not they hold a ticket or ever paid. Withheld here rather than
    // hidden in the UI, because the JSON is the thing that is actually served.
    const visible = canSeeMeetingLink(event, { isStaff: hasMinRole(userRole, ROLES.FACILITATOR), hasTicket });

    return NextResponse.json({ ...redactMeetingUrl(event, visible), hasTicket, isSpeakerAssigned, speakerProfileId });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = eventPartialSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  try {
    await loadEventOr403(supabase, Number(id), guard.user, "edit");
    const event = await updateEvent(supabase, Number(id), parsed.data, { id: guard.user.id });
    return NextResponse.json(event);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  try {
    await loadEventOr403(supabase, Number(id), guard.user, "delete");
    await deleteEvent(supabase, Number(id), { id: guard.user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
