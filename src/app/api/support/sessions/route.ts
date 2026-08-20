import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole, requireRole } from "@/modules/auth/lib/role-guard";
import { forbidden, guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { claimCase, endCase, openOrReuseSession, releaseCase } from "@/modules/chat/lib/support-service";

export async function GET() {
  const supabase = getServiceClient();

  const guard = await requireMinRole(ROLES.FACILITATOR);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const sessions = await chatDao.listActiveSessions(supabase);

  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const action = body.action ?? "end";
  const targetUserId = body.user_id ? Number(body.user_id) : guard.user.id;

  const isOwn = targetUserId === guard.user.id;
  const isStaff = hasMinRole(guard.user.role, ROLES.ADMIN);

  if (!isOwn && !isStaff) {
    return forbidden();
  }

  if (action === "start") {
    if (!isOwn) {
      return NextResponse.json({ error: "Can only start your own session" }, { status: 400 });
    }

    try {
      const session = await openOrReuseSession(supabase, { userId: targetUserId, role: guard.user.role });
      return NextResponse.json({ session });
    } catch (err) {
      return toErrorResponse(err);
    }
  }

  if (action === "claim" || action === "relinquish") {
    try {
      const session =
        action === "claim"
          ? await claimCase(supabase, targetUserId, guard.user.id)
          : await releaseCase(supabase, targetUserId, guard.user.id);
      return NextResponse.json({ session });
    } catch (err) {
      return toErrorResponse(err);
    }
  }

  try {
    const session = await endCase(supabase, targetUserId, { id: guard.user.id, role: guard.user.role });
    return NextResponse.json({ session: session ?? null });
  } catch (err) {
    return toErrorResponse(err);
  }
}
