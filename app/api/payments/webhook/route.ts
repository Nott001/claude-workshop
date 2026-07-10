import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/hitpay";
import { canTransitionPayment, generateQrToken } from "@/modules/commerce";

export async function POST(req: Request) {
  const signature = req.headers.get("hitpay-signature") ?? "";

  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, string>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const hitpayReferenceId = payload.reference_id;
  const hitpayStatus = payload.status;

  if (!hitpayReferenceId || !hitpayStatus) {
    return NextResponse.json({ error: "Missing reference_id or status" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: existingPayment } = await supabase
    .from("PAYMENTS")
    .select("payment_id, status, user_id, event_id")
    .eq("hitpay_reference_id", hitpayReferenceId)
    .single();

  if (!existingPayment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  const dbStatus = hitpayStatus === "completed" ? "paid" : hitpayStatus === "failed" ? "failed" : null;

  if (!dbStatus) {
    return NextResponse.json({ error: `Unknown status: ${hitpayStatus}` }, { status: 400 });
  }

  if (!canTransitionPayment(existingPayment.status, dbStatus)) {
    return NextResponse.json({ error: `Cannot transition from ${existingPayment.status} to ${dbStatus}` }, { status: 422 });
  }

  const updateFields: Record<string, string | null> = { status: dbStatus };
  if (dbStatus === "paid") {
    updateFields.paid_at = new Date().toISOString();
  }

  const { error: updateError } = await supabase
    .from("PAYMENTS")
    .update(updateFields)
    .eq("payment_id", existingPayment.payment_id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (dbStatus === "paid") {
    const { data: existingTicket } = await supabase
      .from("TICKETS")
      .select("payment_id")
      .eq("payment_id", existingPayment.payment_id)
      .single();

    if (!existingTicket) {
      const qrToken = generateQrToken();

      const { error: ticketError } = await supabase.from("TICKETS").insert({
        payment_id: existingPayment.payment_id,
        user_id: existingPayment.user_id,
        event_id: existingPayment.event_id,
        qr_token: qrToken,
      });

      if (ticketError) {
        return NextResponse.json({ error: ticketError.message }, { status: 500 });
      }

      const { fireAndForgetEmailNotification } = await import("@/modules/notifications/email");
      const [{ data: user }, { data: event }] = await Promise.all([
        supabase.from("USERS").select("email, full_name").eq("user_id", existingPayment.user_id).single(),
        supabase.from("EVENTS").select("title, event_date").eq("event_id", existingPayment.event_id).single(),
      ]);
      if (user && event) {
        fireAndForgetEmailNotification({
          user_id: existingPayment.user_id,
          email: user.email,
          name: user.full_name,
          email_type: "ticket_issued",
          eventTitle: event.title,
          eventDate: event.event_date,
        });
      }
    }
  }

  return NextResponse.json({ success: true });
}
