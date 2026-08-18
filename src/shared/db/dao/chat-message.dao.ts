import { ROLES } from "@/shared/lib/roles";
import type { DbClient } from "./types";
import { escapeOrValue, runCursorFeed, throwOnDbError } from "./helpers";
import type { ChatMessage, UserRole } from "@/shared/types";

export async function findMessageWithUser(
  supabase: DbClient,
  messageId: number,
): Promise<(ChatMessage & { USER: { full_name: string; role: UserRole } }) | null> {
  const { data, error } = await supabase
    .from("CHAT_MESSAGE")
    .select("*, USER:user_id(full_name, role)")
    .eq("id", messageId)
    .maybeSingle();
  throwOnDbError(error, "chat-message.dao.findMessageWithUser");
  return data as unknown as (ChatMessage & { USER: { full_name: string; role: UserRole } }) | null;
}
import { findLatestSession, type LatestSession } from "./support-session.dao";

export async function listMessages(
  supabase: DbClient,
  supportType: string,
  options: {
    before?: string | null;
    after?: string | null;
    limit: number;
  },
): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  const query = supabase.from("CHAT_MESSAGE").select("*, USER:user_id(full_name, role)").eq("support_type", supportType);

  const { data, nextCursor } = await runCursorFeed<ChatMessage>(query, "sent_at", options);
  return { messages: data, nextCursor };
}

export async function sendMessage(
  supabase: DbClient,
  data: {
    support_type: string;
    user_id: number;
    message: string;
    recipient_user_id?: number;
    session_id?: number;
  },
): Promise<ChatMessage | null> {
  const { data: message, error } = await supabase
    .from("CHAT_MESSAGE")
    .insert(data)
    .select("*, USER:user_id(full_name, role)")
    .single();

  if (error) {
    console.error("chat-message.dao.sendMessage failed:", error.message, error.code);
    return null;
  }
  return message;
}

export async function countRecentByUser(
  supabase: DbClient,
  userId: number,
  supportType: string,
  windowStart: string,
): Promise<number> {
  const query = supabase
    .from("CHAT_MESSAGE")
    .select("*", { count: "exact", head: true })
    .eq("support_type", supportType)
    .eq("user_id", userId)
    .gte("sent_at", windowStart);

  const { count } = await query;
  return count ?? 0;
}

export async function findMessageById(supabase: DbClient, messageId: number): Promise<{ id: number } | null> {
  const { data, error } = await supabase.from("CHAT_MESSAGE").select("id").eq("id", messageId).maybeSingle();
  throwOnDbError(error, "chat-message.dao.findMessageById");
  return data;
}

export async function deleteMessagesByIds(supabase: DbClient, ids: number[]): Promise<boolean> {
  const { error } = await supabase.from("CHAT_MESSAGE").delete().in("id", ids);
  return !error;
}

export async function deleteMessagesByUser(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("CHAT_MESSAGE").delete().eq("user_id", userId);
  return !error;
}

export async function deleteMessagesByRecipient(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("CHAT_MESSAGE").delete().eq("recipient_user_id", userId);
  return !error;
}

export async function listSupportMessages(
  supabase: DbClient,
  options: {
    userId?: number;
    role?: string;
    supportType: string;
    before?: string | null;
    after?: string | null;
    limit: number;
    filterUserId?: string | null;
  },
): Promise<{
  messages: ChatMessage[];
  nextCursor: string | null;
  sessionActive: boolean;
  session: LatestSession | null;
}> {
  const { userId, role, supportType, before, after, limit, filterUserId } = options;

  let sessionActive = false;
  let sessionId: number | null = null;
  let session: LatestSession | null = null;

  let query = supabase.from("CHAT_MESSAGE").select("*, USER:user_id(full_name, role)").eq("support_type", supportType);

  if (role !== ROLES.FACILITATOR && role !== ROLES.ADMIN && role !== ROLES.SUPER_ADMIN && userId) {
    query = query.or(`user_id.eq.${escapeOrValue(userId)},recipient_user_id.eq.${escapeOrValue(userId)}`);

    session = await findLatestSession(supabase, userId, supportType);
    if (session) {
      sessionActive = session.status === "active";
      sessionId = session.id;
    }
  } else if (filterUserId && userId) {
    query = query.or(
      `user_id.eq.${escapeOrValue(filterUserId)},and(user_id.eq.${escapeOrValue(userId)},recipient_user_id.eq.${escapeOrValue(filterUserId)})`,
    );

    session = await findLatestSession(supabase, Number(filterUserId), supportType);
    if (session) {
      sessionId = session.id;
      sessionActive = session.status === "active";
    }
  }

  if (sessionId !== null) {
    query = query.eq("session_id", sessionId);
  } else {
    query = query.is("session_id", null);
  }

  const { data, nextCursor } = await runCursorFeed<ChatMessage>(query, "sent_at", { before, after, limit });

  return { messages: data, nextCursor, sessionActive, session };
}

export async function listRecentSupportMessages(supabase: DbClient, since: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("CHAT_MESSAGE")
    .select("user_id, recipient_user_id, message, sent_at, session_id, support_type, USER:user_id!inner(full_name, role)")
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
