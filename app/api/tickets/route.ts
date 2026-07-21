import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";

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

  let query = supabase
    .from("TICKETS")
    .select("*, EVENTS(title, event_date, start_time, end_time, venue_name, venue_address, price, currency)")
    .order("issued_at", { ascending: false });

  if (dbUser.role === "attendee") {
    query = query.eq("user_id", dbUser.user_id);
  }

  const { data: tickets, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(tickets);
}
