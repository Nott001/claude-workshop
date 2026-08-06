import type { DbClient } from "./types";
import type { ChatMessage, UserRole } from "@/shared/types";

export async function findMessageWithUser(
  supabase: DbClient,
  messageId: number,
): Promise<(ChatMessage & { USER: { full_name: string; role: UserRole } }) | null> {
  const { data } = await supabase.from("CHAT_MESSAGE").select("*, USER:user_id(full_name, role)").eq("id", messageId).single();
  return data as unknown as (ChatMessage & { USER: { full_name: string; role: UserRole } }) | null;
}
import { findLatestSession, type LatestSession } from "./support-session.dao";

export async function listMessages(
  supabase: DbClient,
  eventId: number | null,
  supportType: string,
  options: {
    before?: string | null;
    after?: string | null;
    limit: number;
  },
): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  const { before, after, limit } = options;

  let query = supabase
    .from("CHAT_MESSAGE")
    .select("*, USER:user_id(full_name, role)")
    .eq("support_type", supportType)
    .is("deleted_at", null);

  if (eventId !== null) {
    query = query.eq("event_id", eventId);
  } else {
    query = query.is("event_id", null);
  }

  if (after) {
    query = query.gt("sent_at", after).order("sent_at", { ascending: true });
  } else {
    query = query.order("sent_at", { ascending: false });
  }

  if (before) {
    query = query.lt("sent_at", before);
  }

  const { data } = await query.limit(limit + 1);

  const messages = (data ?? []) as unknown as ChatMessage[];
  const hasMore = messages.length > limit;
  const result = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore && result.length > 0 ? result[result.length - 1].sent_at : null;

  if (!after) result.reverse();

  return { messages: result, nextCursor };
}

export async function sendMessage(
  supabase: DbClient,
  data: {
    event_id?: number | null;
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

  if (error) return null;
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
    .gte("sent_at", windowStart)
    .is("deleted_at", null);

  const { count } = await query;
  return count ?? 0;
}

export async function findMessageById(
  supabase: DbClient,
  messageId: number,
): Promise<{ id: number; event_id?: number | null } | null> {
  const { data } = await supabase.from("CHAT_MESSAGE").select("id, event_id").eq("id", messageId).single();
  return data;
}

export async function updateMessage(supabase: DbClient, messageId: number, updates: Record<string, unknown>): Promise<boolean> {
  const { error } = await supabase.from("CHAT_MESSAGE").update(updates).eq("id", messageId);
  return !error;
}

export async function softDeleteMessages(supabase: DbClient, ids: number[]): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("CHAT_MESSAGE").update({ deleted_at: now, updated_at: now }).in("id", ids);
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
    eventId?: number | null;
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
  const { userId, role, supportType, eventId, before, after, limit, filterUserId } = options;

  let sessionActive = false;
  let sessionId: number | null = null;
  let session: LatestSession | null = null;

  let query = supabase
    .from("CHAT_MESSAGE")
    .select("*, USER:user_id(full_name, role)")
    .eq("support_type", supportType)
    .is("deleted_at", null);

  if (eventId !== undefined) {
    if (eventId !== null) {
      query = query.eq("event_id", eventId);
    } else {
      query = query.is("event_id", null);
    }
  }

  if (role !== "facilitator" && role !== "admin" && role !== "super_admin" && userId) {
    query = query.or(`user_id.eq.${userId},recipient_user_id.eq.${userId}`);

    session = await findLatestSession(supabase, userId, supportType, eventId ?? undefined);
    if (session) {
      sessionActive = session.status === "active";
      sessionId = session.id;
    }
  } else if (filterUserId && userId) {
    query = query.or(`user_id.eq.${filterUserId},and(user_id.eq.${userId},recipient_user_id.eq.${filterUserId})`);

    session = await findLatestSession(supabase, Number(filterUserId), supportType, eventId ?? undefined);
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

  if (after) {
    query = query.gt("sent_at", after).order("sent_at", { ascending: true });
  } else {
    query = query.order("sent_at", { ascending: false });
  }

  if (before) {
    query = query.lt("sent_at", before);
  }

  const { data } = await query.limit(limit + 1);

  const messages = (data ?? []) as ChatMessage[];
  const hasMore = messages.length > limit;
  const result = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore && result.length > 0 ? result[result.length - 1].sent_at : null;

  if (!after) result.reverse();

  return { messages: result, nextCursor, sessionActive, session };
}

export async function listRecentSupportMessages(supabase: DbClient, since: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("CHAT_MESSAGE")
    .select("user_id, recipient_user_id, message, sent_at, session_id, support_type, USER:user_id!inner(full_name, role)")
    .gte("sent_at", since)
    .is("deleted_at", null)
    .order("sent_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
