import type { DbClient } from "./types";
import type { ChatMessage } from "@/shared/types";
import { findLatestSession } from "./support-session.dao";

export async function listMessages(
  supabase: DbClient,
  eventId: number,
  channel: string,
  options: {
    before?: string | null;
    after?: string | null;
    limit: number;
  },
): Promise<{ messages: ChatMessage[]; nextCursor: string | null }> {
  const { before, after, limit } = options;

  let query = supabase
    .from("CHAT_MESSAGE")
    .select("*, USER:id(full_name, role)")
    .eq("event_id", eventId)
    .eq("channel", channel)
    .is("deleted_at", null);

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
    event_id: number;
    channel: string;
    user_id: number;
    message: string;
    reply_to?: number | null;
    answered_verbally?: boolean;
  },
): Promise<ChatMessage | null> {
  const { data: message, error } = await supabase
    .from("CHAT_MESSAGE")
    .insert(data)
    .select("*, USER:id(full_name, role)")
    .single();

  if (error) return null;
  return message;
}

export async function sendSupportMessage(
  supabase: DbClient,
  data: {
    channel: string;
    event_id: number;
    user_id: number;
    message: string;
    session_id: number;
    recipient_user_id?: number;
  },
): Promise<ChatMessage | null> {
  const { data: message, error } = await supabase
    .from("CHAT_MESSAGE")
    .insert(data)
    .select("*, USER:id(full_name, role)")
    .single();

  if (error) return null;
  return message;
}

export async function countRecentByUser(
  supabase: DbClient,
  userId: number,
  eventId: number,
  channel: string,
  windowStart: string,
): Promise<number> {
  const { count } = await supabase
    .from("CHAT_MESSAGE")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("channel", channel)
    .eq("user_id", userId)
    .gte("sent_at", windowStart)
    .is("deleted_at", null);

  return count ?? 0;
}

export async function countRecentSupportByUser(supabase: DbClient, userId: number, windowStart: string): Promise<number> {
  const { count } = await supabase
    .from("CHAT_MESSAGE")
    .select("*", { count: "exact", head: true })
    .eq("channel", "support")
    .eq("user_id", userId)
    .gte("sent_at", windowStart)
    .is("deleted_at", null);

  return count ?? 0;
}

export async function findMessageById(
  supabase: DbClient,
  messageId: number,
  eventId?: number,
): Promise<{ id: number; event_id?: number } | null> {
  let query = supabase.from("CHAT_MESSAGE").select("id, event_id").eq("id", messageId);

  if (eventId !== undefined) {
    query = query.eq("event_id", eventId);
  }

  const { data } = await query.single();
  return data;
}

export async function findReplies(supabase: DbClient, messageId: number, eventId?: number): Promise<ChatMessage[]> {
  let query = supabase.from("CHAT_MESSAGE").select("id").eq("reply_to", messageId);

  if (eventId !== undefined) {
    query = query.eq("event_id", eventId);
  }

  const { data } = await query;
  return (data ?? []) as ChatMessage[];
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

export async function deleteMessagesByUser(supabase: DbClient, userId: number, channel?: string): Promise<boolean> {
  let query = supabase.from("CHAT_MESSAGE").delete();

  if (channel) {
    query = query.eq("channel", channel);
  }

  const { error } = await query.eq("user_id", userId);
  return !error;
}

export async function deleteMessagesByRecipient(supabase: DbClient, userId: number, channel?: string): Promise<boolean> {
  let query = supabase.from("CHAT_MESSAGE").delete();

  if (channel) {
    query = query.eq("channel", channel);
  }

  const { error } = await query.eq("recipient_user_id", userId);
  return !error;
}

export async function listSupportMessages(
  supabase: DbClient,
  options: {
    userId?: number;
    role?: string;
    before?: string | null;
    after?: string | null;
    limit: number;
    filterUserId?: string | null;
  },
): Promise<{
  messages: ChatMessage[];
  nextCursor: string | null;
  sessionActive: boolean;
}> {
  const { userId, role, before, after, limit, filterUserId } = options;

  let sessionActive = false;
  let sessionId: number | null = null;

  let query = supabase
    .from("CHAT_MESSAGE")
    .select("*, USER:id(full_name, role)")
    .eq("channel", "support")
    .is("deleted_at", null);

  if (role !== "facilitator" && userId) {
    query = query.or(`user_id.eq.${userId},recipient_user_id.eq.${userId}`);

    const session = await findLatestSession(supabase, userId);
    if (session) {
      sessionActive = session.status === "active";
      sessionId = session.id;
    }
  } else if (filterUserId && userId) {
    query = query.or(`user_id.eq.${filterUserId},and(user_id.eq.${userId},recipient_user_id.eq.${filterUserId})`);

    const session = await findLatestSession(supabase, Number(filterUserId));
    if (session) {
      sessionId = session.id;
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

  return { messages: result, nextCursor, sessionActive };
}

export async function listRecentSupportMessages(supabase: DbClient, since: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("CHAT_MESSAGE")
    .select("user_id, recipient_user_id, message, sent_at, session_id, USER:user_id!inner(full_name, role)")
    .eq("channel", "support")
    .gte("sent_at", since)
    .is("deleted_at", null)
    .order("sent_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
