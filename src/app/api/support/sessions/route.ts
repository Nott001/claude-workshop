import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function GET() {
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user || !hasMinRole(user.role, "facilitator")) {
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
  const supportType = body.support_type ?? "general";

  const isOwn = targetUserId === user.id;
  const minRole = supportType === "general" ? "admin" : "facilitator";
  const isStaff = hasMinRole(user.role, minRole as "admin" | "facilitator");

  if (!isOwn && !isStaff) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "start") {
    if (!isOwn) {
      return NextResponse.json({ error: "Can only start your own session" }, { status: 400 });
    }

    const existing = await chatDao.findActiveSession(supabase, targetUserId, supportType);

    if (existing) {
      return NextResponse.json({ session: existing });
    }

    const session = await chatDao.createSession(supabase, targetUserId, supportType);

    if (!session) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({ session });
  }

  if (action === "claim" || action === "relinquish") {
    // Case ownership is a general-support concept for now; event support keeps
    // its current free-for-all until it gets the same overhaul.
    if (supportType !== "general" || isOwn) {
      return NextResponse.json({ error: "Not supported for this session" }, { status: 400 });
    }

    if (action === "claim") {
      const session = await chatDao.claimSession(supabase, targetUserId, supportType, user.id);
      if (!session) {
        return NextResponse.json({ error: "This case is already claimed or has no active session" }, { status: 409 });
      }
      return NextResponse.json({ session });
    }

    const session = await chatDao.relinquishSession(supabase, targetUserId, supportType, user.id);
    if (!session) {
      return NextResponse.json({ error: "You are not the assigned handler of this case" }, { status: 409 });
    }
    return NextResponse.json({ session });
  }

  // end
  if (supportType === "general" && !isOwn) {
    // Ending somebody else's case is reserved for its handler; an unclaimed
    // case can be closed by any staff member so the queue stays cleanable.
    const active = await chatDao.findActiveSession(supabase, targetUserId, supportType);
    if (!active) {
      return NextResponse.json({ error: "No active case for this user" }, { status: 404 });
    }
    if (active.assigned_to !== null && active.assigned_to !== user.id) {
      return NextResponse.json({ error: "Only the assigned handler can end this case" }, { status: 403 });
    }
    const session = await chatDao.endSession(supabase, targetUserId, supportType, undefined, {
      ownerId: active.assigned_to,
    });
    return NextResponse.json({ session: session ?? null });
  }

  const session = await chatDao.endSession(supabase, targetUserId, supportType);

  return NextResponse.json({ session: session ?? null });
}
