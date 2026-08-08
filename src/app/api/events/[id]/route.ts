import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import * as speakerDao from "@/shared/db/dao/speaker.dao";
import { eventPartialSchema } from "@/modules/events/lib/schemas";
import { deleteEvent, EventServiceError, getEvent, loadEventOr403, updateEvent } from "@/modules/events/lib/event-service";

// The 403/404s are answered with a bare string and the 400/500s with a nested
// { message }; keeping both shapes so the wire contract does not change. 403 is
// flat because the role guards this replaces answered "Forbidden" that way.
function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    if (err.status === 404 || err.status === 403) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: { message: err.message } }, { status: err.status });
  }
  throw err;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  const userRole = user?.role ?? null;

  try {
    const event = await getEvent(supabase, Number(id), { id: user?.id ?? null, role: userRole });

    let hasTicket = false;
    let speakerProfileId: number | null = null;
    let isSpeakerAssigned = false;
    if (user) {
      const [ticket, speakerProfile] = await Promise.all([
        ticketDao.findActiveTicketByUserAndEvent(supabase, user.id, event.id),
        speakerDao.findByUserId(supabase, user.id),
      ]);
      hasTicket = !!ticket;
      speakerProfileId = speakerProfile?.id ?? null;
      if (speakerProfileId !== null) {
        isSpeakerAssigned = await speakerDao.checkSpeakerAssignment(supabase, speakerProfileId, event.id);
      }
    }

    return NextResponse.json({ ...event, hasTicket, isSpeakerAssigned, speakerProfileId });
  } catch (err) {
    return mapError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = eventPartialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await loadEventOr403(supabase, Number(id), user, "edit");
    const event = await updateEvent(supabase, Number(id), parsed.data, { id: user.id });
    return NextResponse.json(event);
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    await loadEventOr403(supabase, Number(id), user, "delete");
    const result = await deleteEvent(supabase, Number(id), { id: user.id });
    return NextResponse.json(result);
  } catch (err) {
    return mapError(err);
  }
}
