import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { eventDao, ticketDao, paymentDao } from "@/shared/db/dao";
import { paymentInitSchema } from "@/modules/commerce";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const event = await eventDao.findById(supabase, Number(id));

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status === "draft" && !hasMinRole(user.role, "facilitator")) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const activeTickets = await ticketDao.findActiveByUserAndEvent(supabase, user.id, Number(id));

  return NextResponse.json({
    event,
    user: { user_id: user.id, full_name: user.full_name, email: user.email },
    already_registered: activeTickets.length > 0,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = paymentInitSchema.safeParse({ event_id: id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = await eventDao.findById(supabase, Number(id));
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status === "draft" && !hasMinRole(user.role, "facilitator")) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const activeTickets = await ticketDao.findActiveByUserAndEvent(supabase, user.id, Number(id));

  if (activeTickets.length > 0) {
    return NextResponse.json({ error: "You already have an active ticket for this event" }, { status: 409 });
  }

  const existingPending = await paymentDao.findPendingByUserAndEvent(supabase, user.id, Number(id));

  if (existingPending) {
    return NextResponse.json({ eligible: true, pending_payment_id: existingPending.id });
  }

  return NextResponse.json({ eligible: true });
}
