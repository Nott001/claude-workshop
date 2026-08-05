import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { paymentInitSchema } from "@/modules/commerce/lib/payment-state";
import { SimulatedPaymentGateway } from "@/modules/commerce/lib/payment-gateway";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function POST(req: Request) {
  const supabase = getServiceClient();
  const user = await requireAuth(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
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

  // The active-ticket check has to come first. Resuming a stale pending payment
  // ahead of it let a user who already held a live ticket check out again and
  // receive a second one — nothing in the schema prevents the duplicate.
  const activeTickets = await ticketDao.findActiveByUserAndEvent(supabase, user.id, event_id);

  if (activeTickets.length > 0) {
    return NextResponse.json({ error: "You already have an active ticket for this event" }, { status: 409 });
  }

  const existing = await paymentDao.findLatestByUserAndEvent(supabase, user.id, event_id);

  if (existing && existing.status === "pending") {
    const gateway = new SimulatedPaymentGateway();
    const result = await gateway.createPayment({
      amount: event.price,
      currency: event.currency,
      payment_id: existing.id,
      user_id: user.id,
      event_id,
      user_email: user.email,
      user_name: user.full_name,
    });

    return NextResponse.json({
      payment_id: existing.id,
      checkout_url: result.checkout_url,
    });
  }

  const payment = await paymentDao.create(supabase, {
    user_id: user.id,
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
    user_id: user.id,
    event_id,
    user_email: user.email,
    user_name: user.full_name,
  });

  return NextResponse.json({
    payment_id: payment.id,
    checkout_url: result.checkout_url,
  });
}

export async function GET() {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const supabase = getServiceClient();

  // Scoped by entitlement, not by a literal role string: `requireRole` admits
  // every authenticated role, so anyone who is not staff sees only their own.
  const payments = hasMinRole(guard.user.role, "facilitator")
    ? await paymentDao.listAll(supabase)
    : await paymentDao.listByUser(supabase, guard.user.id);

  return NextResponse.json(payments);
}
