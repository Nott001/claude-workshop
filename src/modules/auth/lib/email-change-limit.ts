import type { DbClient } from "@/shared/db/dao/types";
import * as attemptDao from "@/shared/db/dao/email-change-attempt.dao";

/**
 * Long enough that a burst cannot be waited out in the time it takes to write
 * a script, short enough that someone who mistyped their address twice is not
 * shut out for the afternoon.
 */
export const EMAIL_CHANGE_WINDOW_MS = 15 * 60_000;

/**
 * Per user. Sized against the worst path an honest person takes rather than
 * the tidy one: a typo, the correction, a link that lands in spam, a resend,
 * then giving up on that address and trying another. That is four, and the 60s
 * cooldown does not slow it down — it only gates re-sending the address
 * already pending, so correcting a typo is free. Five leaves one step of room
 * past that and is still nowhere near what draining the mail budget takes.
 */
export const EMAIL_CHANGE_MAX_PER_USER = 5;

/**
 * Per origin, to catch one host driving many accounts. Deliberately loose: this
 * is an events app, so a venue's wifi can put a whole room behind one address,
 * and a limit sized for a single person would lock out an audience. It exists
 * to stop a script, which needs hundreds, not a crowd, which needs tens.
 */
export const EMAIL_CHANGE_MAX_PER_IP = 30;

export type SendVerdict = { allowed: true } | { allowed: false; retryAfter: number };

/**
 * Records this attempt and says whether it may proceed.
 *
 * Keyed on who is asking and where from — never on the address being asked for,
 * and never on the pending-change record. The gate this backs up was keyed on
 * both, and so could be stepped around by naming a different address or by
 * pressing Cancel, which clears the very timestamp it measured. Neither touches
 * this ledger.
 *
 * The attempt is recorded even when it is refused. That keeps a caller who
 * keeps hammering from ever getting through, and it is why the wait returned
 * below moves out as they press: the honest answer to "when may I send?" gets
 * later every time they ask early.
 */
export async function checkEmailChangeSendLimit(
  supabase: DbClient,
  userId: number,
  ip: string | null,
  now: Date = new Date(),
): Promise<SendVerdict> {
  const windowStart = new Date(now.getTime() - EMAIL_CHANGE_WINDOW_MS).toISOString();

  await attemptDao.recordAttempt(supabase, userId, ip);

  // Both counts in one round trip rather than two: the common case is an
  // attempt under both limits, which has to read both anyway.
  const [perUser, perIp] = await Promise.all([
    attemptDao.countByUser(supabase, userId, windowStart),
    ip ? attemptDao.countByIp(supabase, ip, windowStart) : Promise.resolve(0),
  ]);

  const overUser = perUser - EMAIL_CHANGE_MAX_PER_USER;
  const overIp = perIp - EMAIL_CHANGE_MAX_PER_IP;
  if (overUser <= 0 && overIp <= 0) return { allowed: true };

  // Whichever limit is exceeded by more frees last, and that is the one the
  // caller is actually waiting on.
  const [column, value, over] = overUser >= overIp ? (["user_id", userId, overUser] as const) : (["ip", ip!, overIp] as const);

  const freesAt = await attemptDao.nthOldestSince(supabase, column, value, windowStart, over);
  return { allowed: false, retryAfter: secondsUntilFree(freesAt, now) };
}

/**
 * The wait in whole seconds, rounded up so it is never stated short. Falls back
 * to the full window when the ledger could not answer — a refusal has already
 * been decided by then, and the only question left is what to call the wait.
 */
function secondsUntilFree(oldestInWindow: string | null, now: Date): number {
  const oldestMs = new Date(oldestInWindow ?? "").getTime();
  if (!Number.isFinite(oldestMs)) return EMAIL_CHANGE_WINDOW_MS / 1000;

  const remaining = (oldestMs + EMAIL_CHANGE_WINDOW_MS - now.getTime()) / 1000;
  return Math.min(EMAIL_CHANGE_WINDOW_MS / 1000, Math.max(1, Math.ceil(remaining)));
}
