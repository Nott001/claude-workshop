import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { ticketDao, eventDao } from "@/lib/db/dao";
import { checkinSchema, formatCheckinResult } from "@/modules/kiosk";
import { canTransitionTicket } from "@/modules/commerce";
import type { TicketStatus } from "@/types";
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
  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ticket = (await ticketDao.findByQrToken(supabase, parsed.data.qr_token)) as {
    status: TicketStatus;
    payment_id: number;
    user_id: number;
    event_id: number;
    USER: { full_name: string; email: string } | null;
  } | null;

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

  const ok = await ticketDao.updateStatus(supabase, ticket.payment_id, "checked_in", user.id);

  if (!ok) {
    return NextResponse.json({ error: "Failed to update ticket status" }, { status: 500 });
  }

  const { fireAndForgetEmailNotification } = await import("@/modules/notifications/email");
  const userInfo = ticket.USER as { full_name: string; email: string } | undefined;
  if (userInfo) {
    const eventData = await eventDao.findById(supabase, ticket.event_id);
    fireAndForgetEmailNotification({
      user_id: ticket.user_id,
      email: userInfo.email,
      name: userInfo.full_name,
      email_type: "check_in_confirmed",
      eventTitle: eventData?.title ?? "",
      eventDate: eventData?.event_date ?? "",
    });
  }

  if (user) {
    await logAuditEvent(supabase, user.id, "checkin.performed", "ticket", ticket.payment_id, {
      event_id: ticket.event_id,
      attendee_name: (ticket.USER as { full_name?: string } | undefined)?.full_name,
    });
  }

  return NextResponse.json(formatCheckinResult({ ...ticket, status: "issued" as const }));
}
