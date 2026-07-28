import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { ticketDao } from "@/shared/db/dao";

export async function GET() {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();

  let tickets;
  if (guard.user.role === "attendee") {
    tickets = await ticketDao.listByUser(supabase, guard.user.id);
  } else {
    tickets = await ticketDao.listAll(supabase);
  }

  return NextResponse.json(tickets);
}
