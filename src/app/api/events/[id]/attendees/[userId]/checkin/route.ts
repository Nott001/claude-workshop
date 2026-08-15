import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, loadEventOr403 } from "@/modules/events/lib/event-service";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { canTransitionTicket } from "@/modules/commerce/lib/payment-state";
import { sendEmailNotification } from "@/shared/integrations/email/send-notification";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { afterResponse } from "@/shared/lib/after-response";

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

  let event;
  try {
    event = await loadEventOr403(supabase, Number(eventId), user, "attendees_manage");
  } catch (err) {
    return mapError(err);
  }

  const ticket = await ticketDao.findActiveTicketWithUser(supabase, Number(userId), Number(eventId));
  if (!ticket) {
    return NextResponse.json({ error: "No active registration found" }, { status: 404 });
  }

  if (ticket.status === "checked_in") {
    return NextResponse.json({ status: "already_checked_in" });
  }

  if (!canTransitionTicket(ticket.status, "checked_in")) {
    return NextResponse.json({ error: "This registration cannot be checked in" }, { status: 400 });
  }

  const ok = await ticketDao.updateStatus(supabase, ticket.id, "checked_in", user.id);
  if (!ok) {
    return NextResponse.json({ error: "Failed to mark attendance" }, { status: 500 });
  }

  const attendee = ticket.USER;
  if (attendee) {
    // Same deferral as the kiosk check-in: an SMTP round trip has nothing to do
    // with recording the check-in, and the admin table must not wait on it.
    afterResponse(async () => {
      await sendEmailNotification({
        user_id: ticket.user_id,
        email: attendee.email,
        name: attendee.full_name,
        email_type: "check_in_confirmed",
        eventTitle: event.title,
      });
    });
  }

  await requireAuditEvent(supabase, user.id, "checkin.performed", "ticket", ticket.payment_id, {
    event_id: ticket.event_id,
    attendee_name: attendee?.full_name,
  });

  return NextResponse.json({
    status: "checked_in",
    attendee: { full_name: attendee?.full_name ?? "Unknown", email: attendee?.email ?? "" },
  });
}
