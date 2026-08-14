import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, loadEventOr403 } from "@/modules/events/lib/event-service";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { canTransitionTicket } from "@/modules/commerce/lib/payment-state";

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: eventId, userId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    await loadEventOr403(supabase, Number(eventId), user, "attendees_manage");
  } catch (err) {
    return mapError(err);
  }

  const ticket = await ticketDao.findActiveTicketByUserAndEvent(supabase, Number(userId), Number(eventId));
  if (!ticket) {
    return NextResponse.json({ error: "No active registration found" }, { status: 404 });
  }

  if (ticket.status === "checked_in") {
    return NextResponse.json({ error: "A checked-in registration cannot be cancelled" }, { status: 400 });
  }

  if (!canTransitionTicket(ticket.status, "cancelled")) {
    return NextResponse.json({ error: "This registration cannot be cancelled" }, { status: 400 });
  }

  const ok = await ticketDao.updateStatus(supabase, ticket.id, "cancelled");
  if (!ok) {
    return NextResponse.json({ error: "Failed to cancel the registration" }, { status: 500 });
  }

  return NextResponse.json({ status: "cancelled" });
}
