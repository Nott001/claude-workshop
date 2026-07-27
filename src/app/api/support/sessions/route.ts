import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { userDao, chatDao } from "@/lib/db/dao";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const dbUser = await userDao.findByAuthIdWithRole(supabase, userId);
  if (!dbUser || dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sessions = await chatDao.listActiveSessions(supabase);

  return NextResponse.json({ sessions });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const dbUser = await userDao.findByAuthIdWithRole(supabase, userId);
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await req.json();
  const action = body.action ?? "end";
  const targetUserId = body.user_id ? Number(body.user_id) : dbUser.id;

  const isOwn = targetUserId === dbUser.id;
  const isFacilitator = dbUser.role === "facilitator";

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
