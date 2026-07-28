import type { DbClient } from "./types";
import type { SupportSession } from "@/shared/types";

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
