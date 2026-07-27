import type { DbClient } from "./types";
import type { ChatMessage, SupportSession } from "@/types";

const CHANNEL = "global_support" as const;

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
    .eq("channel", CHANNEL)
    .eq("user_id", userId)
    .is("event_id", null)
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

  let query = supabase.from("CHAT_MESSAGE").select("*, USER:id(full_name, role)").eq("channel", CHANNEL).is("deleted_at", null);

  if (role !== "facilitator" && userId) {
    query = query.or(`user_id.eq.${userId},recipient_user_id.eq.${userId}`);

    const latestSession = await supabase
      .from("SUPPORT_SESSION")
      .select("id, status")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSession.data) {
      sessionActive = latestSession.data.status === "active";
      query = query.eq("session_id", latestSession.data.id);
    } else {
      query = query.is("session_id", null);
    }
  } else if (filterUserId && userId) {
    query = query.or(`user_id.eq.${filterUserId},and(user_id.eq.${userId},recipient_user_id.eq.${filterUserId})`);

    const latestSession = await supabase
      .from("SUPPORT_SESSION")
      .select("id")
      .eq("user_id", Number(filterUserId))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSession.data) {
      query = query.eq("session_id", latestSession.data.id);
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

  const { data } = await query.limit(limit + 1);

  const messages = (data ?? []) as unknown as ChatMessage[];
  const hasMore = messages.length > limit;
  const result = hasMore ? messages.slice(0, limit) : messages;
  const nextCursor = hasMore && result.length > 0 ? result[result.length - 1].sent_at : null;

  if (!after) result.reverse();

  return { messages: result, nextCursor, sessionActive };
}

export async function findActiveSession(supabase: DbClient, userId: number): Promise<{ id: number } | null> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return data;
}

export async function findLatestSession(supabase: DbClient, userId: number): Promise<{ id: number; status: string } | null> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("id, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function createSession(supabase: DbClient, userId: number): Promise<SupportSession | null> {
  const { data, error } = await supabase.from("SUPPORT_SESSION").insert({ user_id: userId }).select("*").single();
  if (error) return null;
  return data;
}

export async function endSession(supabase: DbClient, userId: number): Promise<SupportSession | null> {
  const { data, error } = await supabase
    .from("SUPPORT_SESSION")
    .update({ status: "ended_by_facilitator", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("status", "active")
    .select("*")
    .single();

  if (error && error.code !== "PGRST116") return null;
  return data ?? null;
}

export async function deleteSession(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("SUPPORT_SESSION").delete().eq("user_id", userId);
  return !error;
}

export async function listActiveSessions(supabase: DbClient): Promise<unknown[]> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("*, USER(full_name)")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listRecentSessions(supabase: DbClient, since: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("id, user_id, status")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function listRecentSupportMessages(supabase: DbClient, since: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("CHAT_MESSAGE")
    .select("user_id, recipient_user_id, message, sent_at, session_id, USER:user_id!inner(full_name, role)")
    .eq("channel", CHANNEL)
    .gte("sent_at", since)
    .is("deleted_at", null)
    .order("sent_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
