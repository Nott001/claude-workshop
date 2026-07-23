import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { checkinSchema, formatCheckinResult } from "@/modules/kiosk";
import { canTransitionTicket } from "@/modules/commerce";
import { logAuditEvent } from "@/modules/audit";

const DEBUG_BYPASS_EMAIL = process.env.NEXT_PUBLIC_DEBUG_BYPASS_EMAIL === "true";

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
  const { userId } = await auth();

  const { data: dbUser } = await supabase.from("USERS").select("user_id").eq("clerk_id", userId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: ticket, error: lookupError } = await supabase
    .from("TICKETS")
    .select("*, USER:user_id(full_name, email)")
    .eq("qr_token", parsed.data.qr_token)
    .single();

  if (lookupError || !ticket) {
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

  const { error: updateError } = await supabase
    .from("TICKETS")
    .update({
      status: "checked_in",
      checked_in_by: dbUser.user_id,
      updated_at: new Date().toISOString(),
    })
    .eq("payment_id", ticket.payment_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!DEBUG_BYPASS_EMAIL) {
    const { fireAndForgetEmailNotification } = await import("@/modules/notifications/email");
    const userInfo = ticket.USER as { full_name: string; email: string } | undefined;
    if (userInfo) {
      const { data: eventData } = await supabase
        .from("EVENTS")
        .select("title, event_date")
        .eq("event_id", ticket.event_id)
        .single();
      fireAndForgetEmailNotification({
        user_id: ticket.user_id,
        email: userInfo.email,
        name: userInfo.full_name,
        email_type: "check_in_confirmed",
        eventTitle: eventData?.title ?? "",
        eventDate: eventData?.event_date ?? "",
      });
    }
  }

  if (userId) {
    await logAuditEvent(supabase, userId, "checkin.performed", "ticket", ticket.payment_id, {
      event_id: ticket.event_id,
      attendee_name: (ticket.USER as { full_name?: string } | undefined)?.full_name,
    });
  }

  return NextResponse.json(formatCheckinResult({ ...ticket, status: "issued" as const }));
}
