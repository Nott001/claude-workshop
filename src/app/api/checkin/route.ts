import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { ticketDao, eventDao } from "@/shared/db/dao";
import { checkinSchema, formatCheckinResult } from "@/modules/kiosk";
import { canTransitionTicket } from "@/modules/commerce";
import { sendEmailNotification } from "@/modules/notifications/lib/email";
import { logAuditEvent } from "@/modules/audit";

export async function POST(req: Request) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const body = await req.json();
  const parsed = checkinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const ticket = await ticketDao.findByQrToken(supabase, parsed.data.qr_token);

  if (!ticket) {
    return NextResponse.json({ error: "Invalid QR token" }, { status: 404 });
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

  const ok = await ticketDao.updateStatus(supabase, ticket.payment_id, "checked_in", guard.user.id);

  if (!ok) {
    return NextResponse.json({ error: "Failed to update ticket status" }, { status: 500 });
  }

  const userInfo = ticket.USER;
  if (userInfo) {
    const eventData = await eventDao.findById(supabase, ticket.event_id);
    await sendEmailNotification({
      user_id: ticket.user_id,
      email: userInfo.email,
      name: userInfo.full_name,
      email_type: "check_in_confirmed",
      eventTitle: eventData?.title ?? "",
      eventDate: eventData?.event_date ?? "",
    });
  }

  await logAuditEvent(supabase, guard.user.id, "checkin.performed", "ticket", ticket.payment_id, {
    event_id: ticket.event_id,
    attendee_name: ticket.USER?.full_name,
  });

  return NextResponse.json(formatCheckinResult({ ...ticket, status: "issued" as const }));
}
