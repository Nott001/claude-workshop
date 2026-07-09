import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { paymentInitSchema } from "@/modules/commerce";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase
    .from("USERS")
    .select("user_id, full_name, email, role")
    .eq("clerk_id", userId)
    .single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { data: event, error } = await supabase
    .from("EVENTS")
    .select("event_id, title, event_date, start_time, end_time, venue_name")
    .eq("event_id", id)
    .single();

  if (error || !event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: activeTicket } = await supabase
    .from("TICKETS")
    .select("payment_id")
    .eq("user_id", dbUser.user_id)
    .eq("event_id", Number(id))
    .neq("status", "cancelled")
    .limit(1);

  return NextResponse.json({
    event,
    user: { user_id: dbUser.user_id, full_name: dbUser.full_name, email: dbUser.email },
    already_registered: activeTicket && activeTicket.length > 0,
  });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, full_name, email").eq("clerk_id", userId).single();

  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const parsed = paymentInitSchema.safeParse({ event_id: id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: event } = await supabase.from("EVENTS").select("title").eq("event_id", id).single();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: activeTicket } = await supabase
    .from("TICKETS")
    .select("payment_id")
    .eq("user_id", dbUser.user_id)
    .eq("event_id", Number(id))
    .neq("status", "cancelled")
    .limit(1);

  if (activeTicket && activeTicket.length > 0) {
    return NextResponse.json({ error: "You already have an active ticket for this event" }, { status: 409 });
  }

  const { data: existingPending } = await supabase
    .from("PAYMENTS")
    .select("payment_id")
    .eq("user_id", dbUser.user_id)
    .eq("event_id", Number(id))
    .eq("status", "pending")
    .limit(1);

  if (existingPending && existingPending.length > 0) {
    return NextResponse.json({ error: "You already have a pending payment for this event" }, { status: 409 });
  }

  return NextResponse.json({ eligible: true });
}
