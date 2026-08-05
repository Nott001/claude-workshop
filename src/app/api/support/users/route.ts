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

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const allSessions = await chatDao.listRecentSessions(supabase, since);

  const latestSessionPerUser = new Map<number, { session_id: number; status: string }>();
  for (const s of allSessions as Array<{ id: number; user_id: number; status: string }>) {
    if (!latestSessionPerUser.has(s.user_id)) {
      latestSessionPerUser.set(s.user_id, { session_id: s.id, status: s.status });
    }
  }

  const messages = await chatDao.listRecentSupportMessages(supabase, since);

  const userMap = new Map<
    number,
    { user_id: number; full_name: string; last_message: string; last_sent_at: string; session_active: boolean }
  >();

  for (const msg of messages as Array<{
    user_id: number;
    recipient_user_id: number | null;
    message: string;
    sent_at: string;
    session_id: number;
    USER: { full_name: string; role: string } | null;
  }>) {
    const u = msg.USER;
    if (u?.role && hasMinRole(u.role as import("@/shared/types").UserRole, "facilitator")) continue;

    const latest = latestSessionPerUser.get(msg.user_id);
    if (latest && msg.session_id !== latest.session_id) continue;

    if (!userMap.has(msg.user_id)) {
      userMap.set(msg.user_id, {
        user_id: msg.user_id,
        full_name: u?.full_name ?? "Unknown",
        last_message: msg.message,
        last_sent_at: msg.sent_at,
        session_active: latest?.status === "active",
      });
    }
  }

  for (const msg of messages as Array<{
    user_id: number;
    recipient_user_id: number | null;
    message: string;
    sent_at: string;
    session_id: number;
  }>) {
    const recipientId = msg.recipient_user_id;
    if (recipientId != null && userMap.has(recipientId)) {
      const entry = userMap.get(recipientId)!;
      if (new Date(msg.sent_at) > new Date(entry.last_sent_at)) {
        const latest = latestSessionPerUser.get(recipientId);
        if (latest && msg.session_id !== latest.session_id) continue;
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
