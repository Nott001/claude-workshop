import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { claimCase, endCase, openOrReuseSession, releaseCase, SupportServiceError } from "@/modules/chat/lib/support-service";

function mapError(err: unknown): NextResponse {
  if (err instanceof SupportServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function GET() {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user || !hasMinRole(user.role, ROLES.FACILITATOR)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await chatDao.listActiveSessions(supabase);

  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();
  const action = body.action ?? "end";
  const targetUserId = body.user_id ? Number(body.user_id) : user.id;

  const isOwn = targetUserId === user.id;
  const isStaff = hasMinRole(user.role, ROLES.ADMIN);

  if (!isOwn && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "start") {
    if (!isOwn) {
      return NextResponse.json({ error: "Can only start your own session" }, { status: 400 });
    }

    try {
      const session = await openOrReuseSession(supabase, { userId: targetUserId, role: user.role });
      return NextResponse.json({ session });
    } catch (err) {
      return mapError(err);
    }
  }

  if (action === "claim" || action === "relinquish") {
    try {
      const session =
        action === "claim"
          ? await claimCase(supabase, targetUserId, user.id)
          : await releaseCase(supabase, targetUserId, user.id);
      return NextResponse.json({ session });
    } catch (err) {
      return mapError(err);
    }
  }

  try {
    const session = await endCase(supabase, targetUserId, { id: user.id, role: user.role });
    return NextResponse.json({ session: session ?? null });
  } catch (err) {
    return mapError(err);
  }
}
