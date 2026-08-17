import type { DbClient } from "./types";

/**
 * Records one request. Written before the counts are read, so two requests
 * racing cannot both read a total taken before either insert and both conclude
 * they are under the limit.
 */
export async function recordAttempt(supabase: DbClient, email: string, ip: string | null): Promise<void> {
  const { error } = await supabase.from("PASSWORD_RESET_ATTEMPT").insert({ email, ip });
  if (error) {
    console.warn("PASSWORD_RESET_ATTEMPT insert failed:", error.message);
  }
}

async function countSince(supabase: DbClient, column: "email" | "ip", value: string, windowStart: string): Promise<number> {
  const { count, error } = await supabase
    .from("PASSWORD_RESET_ATTEMPT")
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", windowStart);

  if (error) {
    // Fail closed: an unreadable counter must not leave an open mail relay.
    console.error(`PASSWORD_RESET_ATTEMPT ${column} count failed:`, error.message);
    return Number.MAX_SAFE_INTEGER;
  }

  return count ?? 0;
}

/** Requests naming this address inside the window, including the current one. */
export function countByEmail(supabase: DbClient, email: string, windowStart: string): Promise<number> {
  return countSince(supabase, "email", email, windowStart);
}

/** Requests from this address inside the window, whichever email they named. */
export function countByIp(supabase: DbClient, ip: string, windowStart: string): Promise<number> {
  return countSince(supabase, "ip", ip, windowStart);
}

export async function deleteByEmail(supabase: DbClient, email: string): Promise<boolean> {
  const { error } = await supabase.from("PASSWORD_RESET_ATTEMPT").delete().eq("email", email);
  return !error;
}
