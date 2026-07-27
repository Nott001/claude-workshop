import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { eventDao, userDao, chatDao } from "@/lib/db/dao";
import { sendMessageSchema, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "@/modules/chat";

export async function GET(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { eventId } = await params;
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const before = searchParams.get("before");
  const after = searchParams.get("after");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 50);

  if (!channel || !["support", "live_qa"].includes(channel)) {
    return NextResponse.json({ error: "Invalid or missing channel parameter" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const event = await eventDao.findById(supabase, Number(eventId));
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let userRole: string | null = null;
  const dbUser = await userDao.findByAuthIdWithRole(supabase, userId);
  userRole = dbUser?.role ?? null;

  if (event.status === "draft" && userRole !== "facilitator") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { messages, nextCursor } = await chatDao.listMessages(supabase, Number(eventId), channel, {
    before: before ?? null,
    after: after ?? null,
    limit,
  });

  return NextResponse.json({ messages, nextCursor });
}

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { eventId } = await params;
  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const event = await eventDao.findById(supabase, Number(eventId));
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const dbUser = await userDao.findByAuthIdWithRole(supabase, userId);
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  const userRole = dbUser.role;

  if (event.status === "draft" && userRole !== "facilitator") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const count = await chatDao.countRecentByUser(supabase, dbUser.id, Number(eventId), parsed.data.channel, windowStart);

  if (count >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  const message = await chatDao.sendMessage(supabase, {
    event_id: Number(eventId),
    channel: parsed.data.channel,
    user_id: dbUser.id,
    message: parsed.data.message,
    reply_to: parsed.data.reply_to ?? null,
    answered_verbally: parsed.data.answered_verbally ?? false,
  });

  if (!message) {
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }

  return NextResponse.json(message, { status: 201 });
}
