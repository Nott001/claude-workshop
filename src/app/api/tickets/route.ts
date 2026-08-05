import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET() {
  const guard = await requireRole("attendee", "facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const supabase = getServiceClient();

  // `requireRole("attendee", ...)` admits every authenticated role, so the
  // listing has to be scoped by what the caller is allowed to see rather than
  // by a literal "attendee" test — a speaker is neither an attendee nor staff
  // and used to fall through to the unscoped listing.
  const tickets = hasMinRole(guard.user.role, "facilitator")
    ? await ticketDao.listAll(supabase)
    : await ticketDao.listByUser(supabase, guard.user.id);

  return NextResponse.json(tickets);
}
