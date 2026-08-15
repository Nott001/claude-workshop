import type { DbClient } from "@/shared/db/dao/types";
import * as passwordResetDao from "@/shared/db/dao/password-reset.dao";
import { sendTemplatedEmail } from "@/shared/integrations/email/send-templated";
import { passwordResetTemplate } from "@/shared/integrations/email/templates";
import { appBaseUrl } from "@/shared/lib/app-url";
import { evaluatePassword } from "@/shared/lib/password-policy";

/**
 * Fifteen minutes rather than the chat limiter's one: a reset is a once-in-a-
 * while action, so a window long enough to cover a person retrying twice is
 * still far too short to walk a mailbox list.
 */
export const RESET_WINDOW_MS = 15 * 60_000;

/** Per address, so one mailbox cannot be flooded however many hosts ask. */
export const RESET_MAX_PER_EMAIL = 3;

/** Per origin, so one host cannot walk many addresses inside the window. */
export const RESET_MAX_PER_IP = 10;

/** Lowercased and trimmed so casing cannot be used to buy extra attempts. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Requests a reset.
 *
 * Returns nothing in every case. Whether the address owns an account, whether
 * the mail went out, and whether the caller is rate limited are all invisible
 * to the caller by design: a route that answers differently for a known and an
 * unknown address is an enumeration oracle, and this is reachable without a
 * session.
 */
export async function requestPasswordReset(
  supabase: DbClient,
  rawEmail: string,
  ip: string | null,
  now = new Date(),
): Promise<void> {
  const email = normalizeEmail(rawEmail);
  const windowStart = new Date(now.getTime() - RESET_WINDOW_MS).toISOString();

  await passwordResetDao.recordAttempt(supabase, email, ip);

  // Both counts in one round trip rather than two: the common case is a request
  // under both limits, which has to read both anyway.
  const [perEmail, perIp] = await Promise.all([
    passwordResetDao.countByEmail(supabase, email, windowStart),
    ip ? passwordResetDao.countByIp(supabase, ip, windowStart) : Promise.resolve(0),
  ]);

  if (perEmail > RESET_MAX_PER_EMAIL || perIp > RESET_MAX_PER_IP) return;

  // Supabase mints the link but sends nothing, which leaves the message to this
  // project — the same template and mail server as the invitation, rather than
  // one that can only be edited in a dashboard.
  const { data: link, error } = await supabase.auth.admin.generateLink({ type: "recovery", email });

  // An unknown address lands here. Swallowed rather than surfaced, for the same
  // reason the function returns void.
  if (error || !link?.properties?.hashed_token) return;

  const resetUrl = `${appBaseUrl()}/reset-password?token=${link.properties.hashed_token}`;
  const name = (link.user?.user_metadata?.full_name as string | undefined)?.trim() || "there";

  try {
    await sendTemplatedEmail(passwordResetTemplate, { name, resetUrl }, { email, name });
  } catch (err) {
    // The caller is told nothing either way, so a send failure must not become
    // a 500 that distinguishes this address from one that was never mailed.
    console.error("Password reset email failed:", err);
  }
}

export type ConfirmResult =
  { ok: true; authUserId: string } | { ok: false; reason: "invalid_token" | "weak_password" | "personal_password" };

/**
 * Spends the token and sets the new password.
 *
 * `verifyOtp` establishes a session on the passed client, which is what lets
 * `updateUser` run without the caller ever holding the old password.
 */
export async function confirmPasswordReset(supabase: DbClient, token: string, newPassword: string): Promise<ConfirmResult> {
  // Every rule that can be judged without knowing whose token this is, judged
  // first: verifying spends the link, so a password refused here costs a retry
  // on the same one rather than a second reset email.
  if (!evaluatePassword(newPassword).ok) {
    return { ok: false, reason: "weak_password" };
  }

  const { data: verified, error: verifyError } = await supabase.auth.verifyOtp({
    type: "recovery",
    token_hash: token,
  });

  if (verifyError || !verified.user) {
    return { ok: false, reason: "invalid_token" };
  }

  // The account is only known once the token has been verified, so the one rule
  // that needs an identity — that the password is not the user's own name or
  // address — can only be applied here, past the point the link survives. Every
  // other rule was applied above precisely so this one is rarely what fails.
  const identified = evaluatePassword(newPassword, {
    email: verified.user.email,
    fullName: (verified.user.user_metadata as { full_name?: string } | undefined)?.full_name,
  });
  if (!identified.ok) {
    return { ok: false, reason: "personal_password" };
  }

  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
  if (updateError) {
    // The token is spent by now, so this cannot be retried with the same link.
    console.error("Password reset update failed:", updateError.message);
    return { ok: false, reason: "invalid_token" };
  }

  return { ok: true, authUserId: verified.user.id };
}
