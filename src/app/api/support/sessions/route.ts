import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { chatDao } from "@/shared/db/dao";
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

  const isOwn = targetUserId === user.id;
  const isFacilitator = hasMinRole(user.role, "facilitator");

  if (!isOwn && !isFacilitator) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "start") {
    if (!isOwn) {
      return NextResponse.json({ error: "Can only start your own session" }, { status: 400 });
    }

    const existing = await chatDao.findActiveSession(supabase, targetUserId);

    if (existing) {
      return NextResponse.json({ session: existing });
    }

    const session = await chatDao.createSession(supabase, targetUserId);

    if (!session) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    return NextResponse.json({ session });
  }

  const session = await chatDao.endSession(supabase, targetUserId);

  return NextResponse.json({ session: session ?? null });
}
