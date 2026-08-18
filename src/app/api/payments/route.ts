import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as paymentDao from "@/shared/db/dao/payment.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { paymentInitSchema } from "@/modules/commerce/lib/payment-state";
import { getPaymentGateway } from "@/modules/commerce/lib/payment-gateway";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { isSoldOut, SOLD_OUT_MESSAGE } from "@/shared/lib/event-capacity";

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
  const [event, activeTicket, existing] = await Promise.all([
    paymentDao.findEventForPayment(supabase, event_id),
    ticketDao.findActiveTicketByUserAndEvent(supabase, user.id, event_id),
    paymentDao.findLatestByUserAndEvent(supabase, user.id, event_id),
  ]);

  if (!event || event.status === "draft") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // The active-ticket check has to come first. Resuming a stale pending payment
  // ahead of it let a user who already held a live ticket check out again and
  // receive a second one — nothing in the schema prevents the duplicate.
  if (activeTicket) {
    return NextResponse.json({ error: "You already have an active ticket for this event" }, { status: 409 });
  }

  // Checkout is the last point where a refusal is still free for the buyer: the
  // TICKET trigger enforces the same cap, but by then the money has moved.
  // Only a capped event pays for the count.
  if (event.capacity != null && isSoldOut(event.capacity, await ticketDao.countByEvent(supabase, event_id))) {
    return NextResponse.json({ error: SOLD_OUT_MESSAGE }, { status: 409 });
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

  const result = await getPaymentGateway().createPayment({
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

  // The provider's id must land on the PAYMENT row before the buyer can reach
  // its checkout page, or the confirmation webhook has nothing to match.
  const referenceStored = await paymentDao.updateGatewayReference(supabase, payment_id, result.gateway_reference_id);
  if (!referenceStored) {
    return NextResponse.json({ error: "Failed to record payment reference" }, { status: 500 });
  }

  return NextResponse.json({ payment_id, checkout_url: result.checkout_url });
}

export async function GET(req: Request) {
  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const supabase = getServiceClient();
  const { searchParams } = new URL(req.url);
  const options = {
    page: Number(searchParams.get("page") ?? 1),
    limit: Number(searchParams.get("limit") ?? 50),
  };

  // Scoped by entitlement, not by a role test: `requireRole()` admits any
  // authenticated caller, so anyone who is not staff sees only their own.
  const payments = hasMinRole(guard.user.role, ROLES.FACILITATOR)
    ? await paymentDao.listAll(supabase, options)
    : await paymentDao.listByUser(supabase, guard.user.id, options);

  return NextResponse.json(payments);
}
