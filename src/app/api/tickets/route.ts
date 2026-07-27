import { NextResponse } from "next/server";
import { requireAuth, requireRole } from "@/modules/auth";
import { getServiceClient } from "@/lib/db";
import { ticketDao } from "@/lib/db/dao";

export async function GET() {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();
  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let tickets;
  if (user.role === "attendee") {
    tickets = await ticketDao.listByUser(supabase, user.id);
  } else {
    tickets = await ticketDao.listAll(supabase);
  }

  return NextResponse.json(tickets);
}
