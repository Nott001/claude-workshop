import type { DbClient } from "./types";

const TABLE = "EMAIL_CHANGE_ATTEMPT";

/**
 * Records one attempt. Written before the counts are read, so two requests
 * racing cannot both read a total taken before either insert and both conclude
 * they are under the limit.
 */
export async function recordAttempt(supabase: DbClient, userId: number, ip: string | null): Promise<void> {
  const { error } = await supabase.from(TABLE).insert({ user_id: userId, ip });
  if (error) {
    console.warn(`${TABLE} insert failed:`, error.message);
  }
}

/**
 * Drops every attempt this account made, for the teardown.
 *
 * The rows outlive the window they are read in, and each one ties a user id to
 * an IP address. Staying out of the FK graph is what keeps this table off
 * account deletion's critical path, and it is also what stops the delete
 * cascading on its own — so the teardown has to name it, exactly as it names
 * PASSWORD_RESET_ATTEMPT.
 */
export async function deleteByUser(supabase: DbClient, userId: number): Promise<boolean> {
  const { error } = await supabase.from(TABLE).delete().eq("user_id", userId);
  if (error) console.error(`${TABLE} delete failed:`, error.message);
  return !error;
}

async function countSince(supabase: DbClient, column: "user_id" | "ip", value: string | number, windowStart: string) {
  const { count, error } = await supabase
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq(column, value)
    .gte("created_at", windowStart);

  if (error) {
    // Fail closed: an unreadable counter must not leave an open mail relay.
    console.error(`${TABLE} ${column} count failed:`, error.message);
    return Number.MAX_SAFE_INTEGER;
  }

  return count ?? 0;
}

/** Attempts by this user inside the window, including the current one. */
export function countByUser(supabase: DbClient, userId: number, windowStart: string): Promise<number> {
  return countSince(supabase, "user_id", userId, windowStart);
}

/** Attempts from this origin inside the window, whichever user made them. */
export function countByIp(supabase: DbClient, ip: string, windowStart: string): Promise<number> {
  return countSince(supabase, "ip", ip, windowStart);
}

/**
 * When the `nth` oldest attempt in the window was made, or null if there are
 * fewer than that many.
 *
 * This is what lets a refusal name its wait. A caller `n` attempts over the
 * limit is under it again once `n` of them have aged out, so it is the nth
 * oldest — not the oldest — whose expiry frees the next send. Reading the
 * oldest instead would state a wait shorter than the truth and buy a second
 * refusal for anyone who believed it.
 */
export async function nthOldestSince(
  supabase: DbClient,
  column: "user_id" | "ip",
  value: string | number,
  windowStart: string,
  nth: number,
): Promise<string | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select("created_at")
    .eq(column, value)
    .gte("created_at", windowStart)
    .order("created_at", { ascending: true })
    .limit(nth);

  if (error || !data || data.length < nth) return null;
  return (data[nth - 1] as { created_at: string }).created_at;
}
