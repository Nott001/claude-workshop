import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { chatDao } from "@/shared/db/dao";
import { sendMessageSchema, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "@/modules/chat";

const CHANNEL = "support" as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");
  const after = searchParams.get("after");
  const filterUserId = searchParams.get("user_id");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 50);

  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const result = await chatDao.listSupportMessages(supabase, {
    userId: user.id,
    role: user.role,
    before: before ?? null,
    after: after ?? null,
    limit,
    filterUserId: filterUserId ?? null,
  });

  return NextResponse.json({
    messages: result.messages,
    nextCursor: result.nextCursor,
    session_active: result.sessionActive,
  });
}

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = sendMessageSchema.safeParse({ ...body, channel: CHANNEL });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const sessionUserId = user.role === "facilitator" && parsed.data.recipient_user_id ? parsed.data.recipient_user_id : user.id;

  const [rateLimitCount, existing] = await Promise.all([
    chatDao.countRecentSupportByUser(supabase, user.id, windowStart),
    chatDao.findActiveSession(supabase, sessionUserId),
  ]);

  if (rateLimitCount >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  let sessionId: number;

  if (existing) {
    sessionId = existing.id;
  } else {
    const newSession = await chatDao.createSession(supabase, sessionUserId);
    sessionId = newSession!.id;
  }

  const message = await chatDao.sendSupportMessage(supabase, {
    channel: CHANNEL,
    event_id: 0,
    user_id: user.id,
    message: parsed.data.message,
    session_id: sessionId,
    recipient_user_id: user.role === "facilitator" && parsed.data.recipient_user_id ? parsed.data.recipient_user_id : undefined,
  });

  if (!message) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json(message, { status: 201 });
}
