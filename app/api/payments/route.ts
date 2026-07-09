import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { paymentInitSchema } from "@/modules/commerce";
import { createPayment } from "@/lib/hitpay";

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
      return NextResponse.json({ error: "You already have a pending payment for this event" }, { status: 409 });
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

  try {
    const hitpayRes = await createPayment({
      amount: event.price,
      currency: event.currency,
      reference_id,
      name: dbUser.full_name,
      email: dbUser.email,
    });

    await supabase
      .from("PAYMENTS")
      .update({ hitpay_reference_id: hitpayRes.reference_id })
      .eq("payment_id", payment.payment_id);

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
