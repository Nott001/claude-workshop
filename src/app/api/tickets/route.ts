import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { ticketDao } from "@/shared/db/dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET() {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const supabase = getServiceClient();

  let tickets;
  if (hasMinRole(guard.user.role, "facilitator")) {
    tickets = await ticketDao.listAll(supabase);
  } else {
    tickets = await ticketDao.listByUser(supabase, guard.user.id);
  }

  return NextResponse.json(tickets);
}
