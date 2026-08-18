import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET(_req: Request, { params }: { params: Promise<{ ticketId: string }> }) {
  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { ticketId } = await params;
  const supabase = getServiceClient();
  const ticket = await ticketDao.findByIdWithEvent(supabase, Number(ticketId));

  if (!ticket) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  // A ticket page is a check-in credential; non-staff are held to their own.
  if (!hasMinRole(guard.user.role, ROLES.FACILITATOR) && ticket.user_id !== guard.user.id) {
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  }

  return NextResponse.json(ticket);
}
