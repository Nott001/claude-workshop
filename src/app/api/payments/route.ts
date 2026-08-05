import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { paymentDao, ticketDao } from "@/shared/db/dao";
import { paymentInitSchema } from "@/modules/commerce";
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

  // None of these three depends on the others, so they are issued together
  // rather than in series. The checks below still run in their original order,
  // which is what the double-ticketing rule actually depends on. A missing
  // event now costs two reads that used to be skipped — a rare path, traded for
  // two fewer round trips on every real purchase.
  const [event, activeTickets, existing] = await Promise.all([
    paymentDao.findEventForPayment(supabase, event_id),
    ticketDao.findActiveByUserAndEvent(supabase, user.id, event_id),
    paymentDao.findLatestByUserAndEvent(supabase, user.id, event_id),
  ]);

  if (!event || event.status === "draft") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // The active-ticket check has to come first. Resuming a stale pending payment
  // ahead of it let a user who already held a live ticket check out again and
  // receive a second one — nothing in the schema prevents the duplicate.
  if (activeTickets.length > 0) {
    return NextResponse.json({ error: "You already have an active ticket for this event" }, { status: 409 });
  }

  let payment_id: number;

  if (existing && existing.status === "pending") {
    payment_id = existing.id;
  } else {
    const payment = await paymentDao.create(supabase, {
      user_id: user.id,
      event_id,
      amount: event.price,
      currency: event.currency,
    });

    if (!payment) {
      return NextResponse.json({ error: "Failed to create payment" }, { status: 500 });
    }

    payment_id = payment.id;
  }

  const result = await new SimulatedPaymentGateway().createPayment({
    amount: event.price,
    currency: event.currency,
    payment_id,
    user_id: user.id,
    event_id,
    user_email: user.email,
    user_name: user.full_name,
    // Already loaded above; the gateway used to re-read the same row.
    event: { title: event.title, event_date: event.event_date },
  });

  return NextResponse.json({ payment_id, checkout_url: result.checkout_url });
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
