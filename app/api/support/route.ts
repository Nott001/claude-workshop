import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { sendMessageSchema, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "@/modules/chat";

const CHANNEL = "global_support" as const;

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");
  const after = searchParams.get("after");
  const filterUserId = searchParams.get("user_id");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 50);

  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", userId).single();
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  let query = supabase
    .from("CHAT_MESSAGES")
    .select("*, USER:user_id(full_name, role)")
    .eq("channel", CHANNEL)
    .is("deleted_at", null);

  if (dbUser.role !== "facilitator") {
    query = query.or(`user_id.eq.${dbUser.user_id},recipient_user_id.eq.${dbUser.user_id}`);

    const { data: latestSession } = await supabase
      .from("SUPPORT_SESSIONS")
      .select("session_id")
      .eq("user_id", dbUser.user_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestSession) {
      query = query.eq("session_id", latestSession.session_id);
    } else {
      query = query.is("session_id", null);
    }
  } else if (filterUserId) {
    query = query.or(`user_id.eq.${filterUserId},and(user_id.eq.${dbUser.user_id},recipient_user_id.eq.${filterUserId})`);

    const { data: latestSession } = await supabase
      .from("SUPPORT_SESSIONS")
      .select("session_id")
      .eq("user_id", Number(filterUserId))
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (latestSession) {
      query = query.eq("session_id", latestSession.session_id);
    } else {
      query = query.is("session_id", null);
    }
  }

  if (after) {
    query = query.gt("sent_at", after).order("sent_at", { ascending: true });
  } else {
    query = query.order("sent_at", { ascending: false });
  }

  if (before) {
    query = query.lt("sent_at", before);
  }

  const { data: messages, error } = await query.limit(limit + 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const hasMore = messages ? messages.length > limit : false;
  const result = hasMore ? messages.slice(0, limit) : (messages ?? []);
  const nextCursor = hasMore && result.length > 0 ? result[result.length - 1].sent_at : null;

  if (!after) result.reverse();

  return NextResponse.json({ messages: result, nextCursor });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = sendMessageSchema.safeParse({ ...body, channel: CHANNEL });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", userId).single();
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("CHAT_MESSAGES")
    .select("*", { count: "exact", head: true })
    .eq("channel", CHANNEL)
    .eq("user_id", dbUser.user_id)
    .is("event_id", null)
    .gte("sent_at", windowStart)
    .is("deleted_at", null);

  if (count != null && count >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  const sessionUserId = dbUser.role === "facilitator" && parsed.data.recipient_user_id ? parsed.data.recipient_user_id : dbUser.user_id;

  let sessionId: number;

  const { data: existing } = await supabase
    .from("SUPPORT_SESSIONS")
    .select("session_id")
    .eq("user_id", sessionUserId)
    .eq("status", "active")
    .single();

  if (existing) {
    sessionId = existing.session_id;
  } else {
    const { data: newSession } = await supabase
      .from("SUPPORT_SESSIONS")
      .insert({ user_id: sessionUserId })
      .select("session_id")
      .single();
    sessionId = newSession!.session_id;
  }

  const insertPayload: Record<string, unknown> = {
    channel: CHANNEL,
    user_id: dbUser.user_id,
    message: parsed.data.message,
    session_id: sessionId,
  };

  if (dbUser.role === "facilitator" && parsed.data.recipient_user_id) {
    insertPayload.recipient_user_id = parsed.data.recipient_user_id;
  }

  const { data: message, error } = await supabase
    .from("CHAT_MESSAGES")
    .insert(insertPayload)
    .select("*, USER:user_id(full_name, role)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(message, { status: 201 });
}
