import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import * as eventDao from "@/modules/events/db/event.dao";
import { checkinSchema, formatCheckinResult } from "@/modules/kiosk/lib/checkin";
import { canTransitionTicket } from "@/modules/commerce/lib/payment-state";
import { loadEventOr403 } from "@/modules/events/lib/event-service";
import { sendEmailNotification } from "@/shared/integrations/email/send-notification";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { afterResponse } from "@/shared/lib/after-response";
import { badRequest } from "@/shared/lib/api-response";

export async function POST(req: Request) {
  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  const supabase = getServiceClient();

  const ticket = await ticketDao.findByQrToken(supabase, parsed.data.qr_token);

  if (!ticket) {
    return NextResponse.json({ error: "Invalid QR token" }, { status: 404 });
  }

  // Role-only gating let any facilitator check any event in. The realtime read
  // (sheet 01) is scoped to the event's team, and the mutating routes must not
  // be wider: enforce the same `attendees` capability here.
  try {
    await loadEventOr403(supabase, ticket.event_id, guard.user, "attendees");
  } catch (err) {
    if ((err as { status?: number })?.status === 403) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }

  if (ticket.status === "checked_in") {
    return NextResponse.json(formatCheckinResult(ticket));
  }

  if (ticket.status === "cancelled") {
    return NextResponse.json(formatCheckinResult(ticket));
  }

  if (!canTransitionTicket(ticket.status, "checked_in")) {
    return NextResponse.json({ status: "rejected", reason: "invalid_status" });
  }

  const ok = await ticketDao.updateStatus(supabase, ticket.id, "checked_in", guard.user.id);

  if (!ok) {
    return NextResponse.json({ error: "Failed to update ticket status" }, { status: 500 });
  }

  const userInfo = ticket.USER;
  if (userInfo) {
    // Deferred for the same reason as the ticket email, and more sharply: a
    // kiosk queue cannot wait several seconds per attendee on an SMTP round
    // trip that has nothing to do with admitting them.
    afterResponse(async () => {
      const eventData = await eventDao.findById(supabase, ticket.event_id);
      await sendEmailNotification({
        user_id: ticket.user_id,
        email: userInfo.email,
        name: userInfo.full_name,
        email_type: "check_in_confirmed",
        eventTitle: eventData?.title ?? "",
      });
    });
  }

  await requireAuditEvent(supabase, guard.user.id, "checkin.performed", "ticket", ticket.payment_id, {
    event_id: ticket.event_id,
    attendee_name: ticket.USER?.full_name,
  });

  return NextResponse.json(formatCheckinResult({ ...ticket, status: "issued" as const }));
}
