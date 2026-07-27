import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { eventDao, ticketDao, paymentDao } from "@/lib/db/dao";
import { syncUser } from "@/lib/auth/sync-user";
import { paymentInitSchema } from "@/modules/commerce";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const dbUser = await syncUser(userId);

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const event = (await eventDao.findByIdSelect(
    supabase,
    Number(id),
    "id, title, event_date, start_time, end_time, venue_name, price, currency, status",
  )) as {
    id: number;
    title: string;
    event_date: string;
    start_time: string;
    end_time: string;
    venue_name: string;
    price: number;
    currency: string;
    status: string;
  } | null;

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status === "draft" && dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const activeTickets = await ticketDao.findActiveByUserAndEvent(supabase, dbUser.id, Number(id));

  return NextResponse.json({
    event,
    user: { user_id: dbUser.id, full_name: dbUser.full_name, email: dbUser.email },
    already_registered: activeTickets.length > 0,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const dbUser = await syncUser(userId);

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const parsed = paymentInitSchema.safeParse({ event_id: id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const event = (await eventDao.findByIdSelect(supabase, Number(id), "title, status")) as {
    title: string;
    status: string;
  } | null;
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (event.status === "draft" && dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const activeTickets = await ticketDao.findActiveByUserAndEvent(supabase, dbUser.id, Number(id));

  if (activeTickets.length > 0) {
    return NextResponse.json({ error: "You already have an active ticket for this event" }, { status: 409 });
  }

  const existingPending = await paymentDao.findPendingByUserAndEvent(supabase, dbUser.id, Number(id));

  if (existingPending) {
    return NextResponse.json({ eligible: true, pending_payment_id: existingPending.id });
  }

  return NextResponse.json({ eligible: true });
}
