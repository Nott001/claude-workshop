import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { paymentInitSchema, generateQrToken } from "@/modules/commerce";
import { createPayment } from "@/lib/hitpay";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const DEBUG_BYPASS = process.env.NEXT_PUBLIC_DEBUG_BYPASS_PAYMENT === "true";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: dbUser } = await supabase.from("USERS").select("user_id, full_name, email").eq("clerk_id", userId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = paymentInitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { event_id } = parsed.data;

  const { data: event } = await supabase
    .from("EVENTS")
    .select("title, price, currency, status")
    .eq("event_id", event_id)
    .single();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status === "draft") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: existing } = await supabase
    .from("PAYMENTS")
    .select("payment_id, status")
    .eq("user_id", dbUser.user_id)
    .eq("event_id", event_id)
    .order("created_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) {
    const last = existing[0];
    if (last.status === "pending") {
      if (DEBUG_BYPASS) {
        const { error: updateError } = await supabase
          .from("PAYMENTS")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("payment_id", last.payment_id);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 500 });
        }

        const qrToken = generateQrToken();
        const { error: ticketError } = await supabase.from("TICKETS").insert({
          payment_id: last.payment_id,
          user_id: dbUser.user_id,
          event_id,
          qr_token: qrToken,
        });

        if (ticketError) {
          return NextResponse.json({ error: ticketError.message }, { status: 500 });
        }

        return NextResponse.json({
          payment_id: last.payment_id,
          checkout_url: `${APP_URL}/checkout/${last.payment_id}?success=true`,
        });
      }
      return NextResponse.json({ payment_id: last.payment_id });
    }
  }

  const { data: activeTicket } = await supabase
    .from("TICKETS")
    .select("payment_id")
    .eq("user_id", dbUser.user_id)
    .eq("event_id", event_id)
    .neq("status", "cancelled")
    .limit(1);

  if (activeTicket && activeTicket.length > 0) {
    return NextResponse.json({ error: "You already have an active ticket for this event" }, { status: 409 });
  }

  const reference_id = `${dbUser.user_id}_${event_id}_${Date.now()}`;

  const { data: payment, error } = await supabase
    .from("PAYMENTS")
    .insert({ user_id: dbUser.user_id, event_id, amount: event.price, currency: event.currency })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (DEBUG_BYPASS) {
    const { error: updateError } = await supabase
      .from("PAYMENTS")
      .update({ status: "paid", paid_at: new Date().toISOString() })
      .eq("payment_id", payment.payment_id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const qrToken = generateQrToken();
    const { error: ticketError } = await supabase.from("TICKETS").insert({
      payment_id: payment.payment_id,
      user_id: dbUser.user_id,
      event_id,
      qr_token: qrToken,
    });

    if (ticketError) {
      return NextResponse.json({ error: ticketError.message }, { status: 500 });
    }

    return NextResponse.json({
      payment_id: payment.payment_id,
      checkout_url: `${APP_URL}/checkout/${payment.payment_id}?success=true`,
    });
  }

  try {
    const hitpayRes = await createPayment({
      amount: event.price,
      currency: event.currency,
      reference_id,
      payment_id: payment.payment_id,
      name: dbUser.full_name,
      email: dbUser.email,
    });

    await supabase
      .from("PAYMENTS")
      .update({ hitpay_reference_id: hitpayRes.reference_id })
      .eq("payment_id", payment.payment_id);

    const { fireAndForgetEmailNotification } = await import("@/modules/notifications/email");
    fireAndForgetEmailNotification({
      user_id: dbUser.user_id,
      email: dbUser.email,
      name: dbUser.full_name,
      email_type: "registration_confirmation",
      eventTitle: event.title,
      eventDate: event.event_date,
    });

    return NextResponse.json({
      payment_id: payment.payment_id,
      checkout_url: hitpayRes.url,
    });
  } catch {
    return NextResponse.json({ error: "Failed to initiate payment with HitPay" }, { status: 502 });
  }
}

export async function GET() {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();
  const { data: dbUser } = await supabase
    .from("USERS")
    .select("user_id, role")
    .eq("clerk_id", (await auth()).userId)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let query = supabase.from("PAYMENTS").select("*, EVENTS(title)").order("created_at", { ascending: false });

  if (dbUser.role === "attendee") {
    query = query.eq("user_id", dbUser.user_id);
  }

  const { data: payments, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(payments);
}
