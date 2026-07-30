import type { DbClient } from "./types";
import type { SupportSession } from "@/shared/types";

export async function findActiveSession(
  supabase: DbClient,
  userId: number,
  supportType: string,
  eventId?: number,
): Promise<{ id: number } | null> {
  let query = supabase
    .from("SUPPORT_SESSION")
    .select("id")
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

export async function findLatestSession(
  supabase: DbClient,
  userId: number,
  supportType: string,
  eventId?: number,
): Promise<{ id: number; status: string } | null> {
  let query = supabase.from("SUPPORT_SESSION").select("id, status").eq("user_id", userId).eq("support_type", supportType);

  if (eventId !== undefined) {
    query = query.eq("event_id", eventId);
  } else {
    query = query.is("event_id", null);
  }

  const { data } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  return data;
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
  if (error) return null;
  return data;
}

export async function endSession(
  supabase: DbClient,
  userId: number,
  supportType: string,
  eventId?: number,
): Promise<SupportSession | null> {
  let query = supabase
    .from("SUPPORT_SESSION")
    .update({ status: "ended_by_facilitator", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("support_type", supportType)
    .eq("status", "active");

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

export async function listRecentSessions(supabase: DbClient, since: string): Promise<unknown[]> {
  const { data } = await supabase
    .from("SUPPORT_SESSION")
    .select("id, user_id, status, support_type, event_id")
    .gte("created_at", since)
    .order("created_at", { ascending: false });
  return data ?? [];
}
