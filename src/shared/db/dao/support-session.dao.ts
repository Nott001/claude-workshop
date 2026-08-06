import type { DbClient } from "./types";
import type { SupportSession } from "@/shared/types";

export interface CaseSummary {
  id: number;
  case_number: number;
  status: string;
  user_id: number;
  full_name: string;
  assigned_to: number | null;
  assigned_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
}

export async function findActiveSession(
  supabase: DbClient,
  userId: number,
  supportType: string,
  eventId?: number,
): Promise<{ id: number; case_number: number; assigned_to: number | null } | null> {
  let query = supabase
    .from("SUPPORT_SESSION")
    .select("id, case_number, assigned_to")
    .eq("user_id", userId)
    .eq("support_type", supportType)
    .eq("status", "active");

  if (eventId !== undefined) {
    query = query.eq("event_id", eventId);
  } else {
    query = query.is("event_id", null);
  }

  const { data } = await query.maybeSingle();
  return data;
}

export interface LatestSession {
  id: number;
  status: string;
  case_number: number;
  assigned_to: number | null;
  ASSIGNED: { full_name: string } | null;
}

export async function findLatestSession(
  supabase: DbClient,
  userId: number,
  supportType: string,
  eventId?: number,
): Promise<LatestSession | null> {
  let query = supabase
    .from("SUPPORT_SESSION")
    .select("id, status, case_number, assigned_to, ASSIGNED:assigned_to(full_name)")
    .eq("user_id", userId)
    .eq("support_type", supportType);

  if (eventId !== undefined) {
    query = query.eq("event_id", eventId);
  } else {
    query = query.is("event_id", null);
  }

  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  // PostgREST returns to-one embeds as objects; the generated client type can
  // misread a second FK to the same table as a collection.
  return data as unknown as LatestSession | null;
}

export async function createSession(
  supabase: DbClient,
  userId: number,
  supportType: string,
  eventId?: number,
): Promise<SupportSession | null> {
  const insertData: Record<string, unknown> = { user_id: userId, support_type: supportType };
  if (eventId !== undefined) {
    insertData.event_id = eventId;
  }
  const { data, error } = await supabase.from("SUPPORT_SESSION").insert(insertData).select("*").single();
  if (error) {
    console.error("support-session.dao.createSession failed:", error.message, error.code);
    return null;
  }
  return data;
}

export async function claimSession(
  supabase: DbClient,
  askerUserId: number,
  supportType: string,
  staffUserId: number,
): Promise<SupportSession | null> {
  const { data, error } = await supabase
    .from("SUPPORT_SESSION")
    .update({ assigned_to: staffUserId, updated_at: new Date().toISOString() })
    .eq("user_id", askerUserId)
    .eq("support_type", supportType)
    .eq("status", "active")
    .is("assigned_to", null)
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function relinquishSession(
  supabase: DbClient,
  askerUserId: number,
  supportType: string,
  staffUserId: number,
): Promise<SupportSession | null> {
  const { data, error } = await supabase
    .from("SUPPORT_SESSION")
    .update({ assigned_to: null, updated_at: new Date().toISOString() })
    .eq("user_id", askerUserId)
    .eq("support_type", supportType)
    .eq("status", "active")
    .eq("assigned_to", staffUserId)
    .select("*")
    .single();
  if (error) return null;
  return data;
}

export async function endSession(
  supabase: DbClient,
  userId: number,
  supportType: string,
  eventId?: number,
  opts?: { ownerId?: number | null },
): Promise<SupportSession | null> {
  // Ending a case removes it and its message history outright: the attendee
  // should start fresh, with no old conversation to continue. Deleting the
  // session cascades to its CHAT_MESSAGE rows via ON DELETE CASCADE.
  let query = supabase
    .from("SUPPORT_SESSION")
    .delete()
    .eq("user_id", userId)
    .eq("support_type", supportType)
    .eq("status", "active");

  if (opts?.ownerId !== undefined) {
    query = opts.ownerId === null ? query.is("assigned_to", null) : query.eq("assigned_to", opts.ownerId);
  }

  if (eventId !== undefined) {
    query = query.eq("event_id", eventId);
  } else {
    query = query.is("event_id", null);
  }

  const { data, error } = await query.select("*").single();

  if (error && error.code !== "PGRST116") return null;
  return data ?? null;
}

export async function deleteSession(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from("SUPPORT_SESSION").delete().eq("user_id", userId);
  return !error;
}

export async function listActiveSessions(supabase: DbClient, supportType?: string): Promise<unknown[]> {
  let query = supabase.from("SUPPORT_SESSION").select("*, USER(full_name)").eq("status", "active");

  if (supportType) {
    query = query.eq("support_type", supportType);
  }

  const { data } = await query.order("created_at", { ascending: false });
  return data ?? [];
}

export async function listCases(supabase: DbClient, supportType: string): Promise<CaseSummary[]> {
  const { data: sessions } = await supabase
    .from("SUPPORT_SESSION")
    .select("*, USER:user_id(full_name, role), ASSIGNED:assigned_to(full_name)")
    .eq("status", "active")
    .eq("support_type", supportType)
    .order("created_at", { ascending: false });

  const rows = (sessions ?? []) as Array<{
    id: number;
    case_number: number;
    user_id: number;
    assigned_to: number | null;
    USER: { full_name: string; role: string } | null;
    ASSIGNED: { full_name: string } | null;
  }>;

  const sessionIds = rows.map((s) => s.id);
  if (sessionIds.length === 0) return [];

  const { data: messages } = await supabase
    .from("CHAT_MESSAGE")
    .select("session_id, message, sent_at")
    .in("session_id", sessionIds)
    .is("deleted_at", null)
    .order("sent_at", { ascending: false });

  const latestBySession = new Map<number, { message: string; sent_at: string }>();
  for (const m of (messages ?? []) as Array<{ session_id: number; message: string; sent_at: string }>) {
    if (!latestBySession.has(m.session_id)) {
      latestBySession.set(m.session_id, { message: m.message, sent_at: m.sent_at });
    }
  }

  return rows.map((s) => {
    const latest = latestBySession.get(s.id);
    return {
      id: s.id,
      case_number: s.case_number,
      status: "active",
      user_id: s.user_id,
      full_name: s.USER?.full_name ?? "Unknown",
      assigned_to: s.assigned_to,
      assigned_name: s.ASSIGNED?.full_name ?? null,
      last_message: latest?.message ?? null,
      last_message_at: latest?.sent_at ?? null,
    };
  });
}

export async function listRecentSessions(supabase: DbClient, since: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("id, user_id, status, support_type, event_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return data ?? [];
}
