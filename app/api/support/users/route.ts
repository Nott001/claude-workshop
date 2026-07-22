import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";

const CHANNEL = "global_support" as const;

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("role").eq("clerk_id", userId).single();
  if (!dbUser || dbUser.role !== "facilitator") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: messages, error } = await supabase
    .from("CHAT_MESSAGES")
    .select("user_id, recipient_user_id, message, sent_at, USER:user_id!inner(full_name, role)")
    .eq("channel", CHANNEL)
    .is("deleted_at", null)
    .order("sent_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: activeSessions } = await supabase.from("SUPPORT_SESSIONS").select("user_id").eq("status", "active");

  const activeUserIds = new Set((activeSessions ?? []).map((s) => s.user_id));

  const userMap = new Map<
    number,
    { user_id: number; full_name: string; last_message: string; last_sent_at: string; unread: boolean; session_active: boolean }
  >();

  for (const msg of messages ?? []) {
    const user = msg.USER as unknown as { full_name: string; role: string } | null;
    if (user?.role === "facilitator") continue;
    if (!userMap.has(msg.user_id)) {
      userMap.set(msg.user_id, {
        user_id: msg.user_id,
        full_name: user?.full_name ?? "Unknown",
        last_message: msg.message,
        last_sent_at: msg.sent_at,
        unread: true,
        session_active: activeUserIds.has(msg.user_id),
      });
    }
  }

  for (const msg of messages ?? []) {
    const recipientId = msg.recipient_user_id;
    if (recipientId != null && userMap.has(recipientId)) {
      const entry = userMap.get(recipientId)!;
      if (new Date(msg.sent_at) > new Date(entry.last_sent_at)) {
        entry.last_message = msg.message;
        entry.last_sent_at = msg.sent_at;
      }
    }
  }

  const users = Array.from(userMap.values()).sort(
    (a, b) => new Date(b.last_sent_at).getTime() - new Date(a.last_sent_at).getTime(),
  );

  return NextResponse.json({ users });
}
