import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { sendMessageSchema, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "@/modules/chat";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(req.url);
  const channel = searchParams.get("channel");
  const before = searchParams.get("before");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 50);

  if (!channel || !["support", "live_qa"].includes(channel)) {
    return NextResponse.json({ error: "Invalid or missing channel parameter" }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: event } = await supabase.from("EVENTS").select("event_id, status").eq("event_id", id).single();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let userRole: string | null = null;
  const { data: dbUser } = await supabase.from("USERS").select("role").eq("clerk_id", userId).single();
  userRole = dbUser?.role ?? null;

  if (event.status === "draft" && userRole !== "facilitator") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let query = supabase
    .from("CHAT_MESSAGES")
    .select("*, USER:user_id(full_name)")
    .eq("event_id", id)
    .eq("channel", channel)
    .is("deleted_at", null)
    .order("sent_at", { ascending: false });

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

  result.reverse();

  return NextResponse.json({ messages: result, nextCursor });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = sendMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const { data: event } = await supabase.from("EVENTS").select("event_id, status").eq("event_id", id).single();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let userRole: string | null = null;
  const { data: dbUser } = await supabase.from("USERS").select("user_id, role").eq("clerk_id", userId).single();
  if (!dbUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }
  userRole = dbUser.role;

  if (event.status === "draft" && userRole !== "facilitator") {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count } = await supabase
    .from("CHAT_MESSAGES")
    .select("*", { count: "exact", head: true })
    .eq("event_id", id)
    .eq("channel", parsed.data.channel)
    .eq("user_id", dbUser.user_id)
    .gte("sent_at", windowStart)
    .is("deleted_at", null);

  if (count != null && count >= RATE_LIMIT_MAX) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  const { data: message, error } = await supabase
    .from("CHAT_MESSAGES")
    .insert({
      event_id: Number(id),
      channel: parsed.data.channel,
      user_id: dbUser.user_id,
      message: parsed.data.message,
    })
    .select("*, USER:user_id(full_name)")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(message, { status: 201 });
}
