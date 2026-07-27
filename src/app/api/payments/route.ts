import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { userDao, paymentDao, ticketDao } from "@/lib/db/dao";
import { paymentInitSchema, SimulatedPaymentGateway } from "@/modules/commerce";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();
  const dbUser = await userDao.findByAuthId(supabase, userId);

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = paymentInitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { event_id } = parsed.data;

  const event = await paymentDao.findEventForPayment(supabase, event_id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status === "draft") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const existing = await paymentDao.findLatestByUserAndEvent(supabase, dbUser.id, event_id);

  if (existing) {
    if (existing.status === "pending") {
      const gateway = new SimulatedPaymentGateway();
      const result = await gateway.createPayment({
        amount: event.price,
        currency: event.currency,
        payment_id: existing.id,
        user_id: dbUser.id,
        event_id,
        user_email: dbUser.email,
        user_name: dbUser.full_name,
      });

      return NextResponse.json({
        payment_id: existing.id,
        checkout_url: result.checkout_url,
      });
    }
  }

  const activeTickets = await ticketDao.findActiveByUserAndEvent(supabase, dbUser.id, event_id);

  if (activeTickets.length > 0) {
    return NextResponse.json({ error: "You already have an active ticket for this event" }, { status: 409 });
  }

  const payment = await paymentDao.create(supabase, {
    user_id: dbUser.id,
    event_id,
    amount: event.price,
    currency: event.currency,
  });

  if (!payment) {
    return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
  }

  const gateway = new SimulatedPaymentGateway();
  const result = await gateway.createPayment({
    amount: event.price,
    currency: event.currency,
    payment_id: payment.id,
    user_id: dbUser.id,
    event_id,
    user_email: dbUser.email,
    user_name: dbUser.full_name,
  });

  return NextResponse.json({
    payment_id: payment.id,
    checkout_url: result.checkout_url,
  });
}

export async function GET() {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();
  const dbUser = await userDao.findByAuthIdWithRole(supabase, (await auth()).userId!);

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let payments;
  if (dbUser.role === "attendee") {
    payments = await paymentDao.listByUser(supabase, dbUser.id);
  } else {
    payments = await paymentDao.listAll(supabase);
  }

  return NextResponse.json(payments);
}
