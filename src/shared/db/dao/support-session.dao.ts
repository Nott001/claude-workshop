import type { DbClient, PaginatedResult } from "./types";
import { pageBounds, throwOnDbError } from "./helpers";
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
): Promise<{ id: number; case_number: number; assigned_to: number | null } | null> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("id, case_number, assigned_to")
    .eq("user_id", userId)
    .eq("support_type", supportType)
    .eq("status", "active")
    .maybeSingle();
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
): Promise<LatestSession | null> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("id, status, case_number, assigned_to, ASSIGNED:assigned_to(full_name)")
    .eq("user_id", userId)
    .eq("support_type", supportType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  // PostgREST returns to-one embeds as objects; the generated client type can
  // misread a second FK to the same table as a collection.
  return data as unknown as LatestSession | null;
}

export async function findById(
  supabase: DbClient,
  id: number,
): Promise<{ id: number; user_id: number; assigned_to: number | null } | null> {
  const { data, error } = await supabase.from("SUPPORT_SESSION").select("id, user_id, assigned_to").eq("id", id).maybeSingle();
  throwOnDbError(error, "support-session.dao.findById");
  return data;
}

export async function createSession(supabase: DbClient, userId: number, supportType: string): Promise<SupportSession | null> {
  const { data, error } = await supabase
    .from("SUPPORT_SESSION")
    .insert({ user_id: userId, support_type: supportType })
    .select("*")
    .single();
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
  opts?: { ownerId?: number | null },
): Promise<SupportSession | null> {
  // Ending a case marks it ended instead of purging it: the attendee keeps
  // reading the thread plus the closing notice, and ships a fresh case only
  // when they send a new message. `deleteSessionsExcept` removes the husk at
  // that point, so history is still not left behind forever.
  let query = supabase
    .from("SUPPORT_SESSION")
    .update({ status: "ended_by_facilitator", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("support_type", supportType)
    .eq("status", "active");

  if (opts?.ownerId !== undefined) {
    query = opts.ownerId === null ? query.is("assigned_to", null) : query.eq("assigned_to", opts.ownerId);
  }

  const { data, error } = await query.select("*").single();

  if (error && error.code !== "PGRST116") return null;
  return data ?? null;
}

export async function deleteSessionsExcept(
  supabase: DbClient,
  userId: number,
  supportType: string,
  keepId: number,
): Promise<boolean> {
  // Opening a fresh case purges whatever prior non-active sessions the user
  // left behind; their CHAT_MESSAGE rows go with them via ON DELETE CASCADE.
  const { error } = await supabase
    .from("SUPPORT_SESSION")
    .delete()
    .eq("user_id", userId)
    .eq("support_type", supportType)
    .neq("id", keepId);
  return !error;
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

export async function listCases(
  supabase: DbClient,
  supportType: string,
  options?: { page?: number; limit?: number },
): Promise<PaginatedResult<CaseSummary>> {
  const { from, to, page, limit } = pageBounds(options);
  const { data: sessions, count } = await supabase
    .from("SUPPORT_SESSION")
    .select("*, USER:user_id(full_name, role), ASSIGNED:assigned_to(full_name)", { count: "exact" })
    .eq("status", "active")
    .eq("support_type", supportType)
    .order("created_at", { ascending: false })
    .range(from, to);

  const rows = (sessions ?? []) as Array<{
    id: number;
    case_number: number;
    user_id: number;
    assigned_to: number | null;
    USER: { full_name: string; role: string } | null;
    ASSIGNED: { full_name: string } | null;
  }>;

  const sessionIds = rows.map((s) => s.id);
  if (sessionIds.length === 0) {
    return { data: [], total: count ?? 0, page, limit };
  }

  const { data: messages } = await supabase
    .from("CHAT_MESSAGE")
    .select("session_id, message, sent_at")
    .in("session_id", sessionIds)
    .order("sent_at", { ascending: false });

  const latestBySession = new Map<number, { message: string; sent_at: string }>();
  for (const m of (messages ?? []) as Array<{ session_id: number; message: string; sent_at: string }>) {
    if (!latestBySession.has(m.session_id)) {
      latestBySession.set(m.session_id, { message: m.message, sent_at: m.sent_at });
    }
  }

  return {
    data: rows.map((s) => {
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
    }),
    total: count ?? 0,
    page,
    limit,
  };
}

export async function listRecentSessions(supabase: DbClient, since: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("id, user_id, status, support_type")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return data ?? [];
}
