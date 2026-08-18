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
 * What a reset request resolved to.
 *
 * `unknown_email` is reported to the caller on purpose: this screen tells a
 * visitor when the address they typed has no account, rather than accepting
 * every address alike. That is a deliberate trade — it makes this route able to
 * answer "does this person have an account?", so the per-IP limit above is the
 * only thing standing between one prober and a mailbox list, and it is applied
 * before the lookup for exactly that reason.
 */
export type ResetOutcome =
  | { status: "ready"; deliver: () => Promise<{ success: boolean; error?: string }>; resetUrl: string }
  | { status: "unknown_email" }
  | { status: "rate_limited" }
  | { status: "failed" };

/**
 * What the browser is told. Declared beside the outcome it is derived from and
 * imported by both the route and the form, so the wire contract has one
 * definition rather than a copy at each end that can drift.
 *
 * `ready` becomes `sent` — the route reports what happened to the request, not
 * what the service decided internally. `delivery_failed` reports a send the
 * route has actually awaited, distinct from `failed`, where the link was never
 * minted at all. `invalid_request` has no outcome behind it: the route rejects
 * those before the service is reached.
 */
export type RecoverStatus = Exclude<ResetOutcome["status"], "ready"> | "sent" | "delivery_failed" | "invalid_request";

/** Supabase answers a recovery link for an address it does not know with a 404. */
function isUnknownUser(error: { status?: number; message?: string } | null): boolean {
  if (!error) return false;
  return error.status === 404 || /user not found/i.test(error.message ?? "");
}

/**
 * Looks the address up and, when it owns an account, mints its reset link.
 *
 * Delivery is handed back as `deliver` rather than awaited here: minting is
 * fast and the SMTP session is not, so the caller runs the send when it wants
 * the verdict — the route awaits it to answer "sent" only once the mail is on
 * its way. `deliver` resolves the provider's result rather than throwing, so a
 * refusing transport reads as a failure the caller can report.
 */
export async function preparePasswordReset(
  supabase: DbClient,
  rawEmail: string,
  ip: string | null,
  now = new Date(),
): Promise<ResetOutcome> {
  const email = normalizeEmail(rawEmail);
  const windowStart = new Date(now.getTime() - RESET_WINDOW_MS).toISOString();

  await passwordResetDao.recordAttempt(supabase, email, ip);

  // Both counts in one round trip rather than two: the common case is a request
  // under both limits, which has to read both anyway.
  const [perEmail, perIp] = await Promise.all([
    passwordResetDao.countByEmail(supabase, email, windowStart),
    ip ? passwordResetDao.countByIp(supabase, ip, windowStart) : Promise.resolve(0),
  ]);

  // Counted and refused before the lookup runs, so a prober is throttled on the
  // question itself rather than on how often it happens to be answered "yes".
  if (perEmail > RESET_MAX_PER_EMAIL || perIp > RESET_MAX_PER_IP) return { status: "rate_limited" };

  // Supabase mints the link but sends nothing, which leaves the message to this
  // project — the same template and mail server as the invitation, rather than
  // one that can only be edited in a dashboard.
  const { data: link, error } = await supabase.auth.admin.generateLink({ type: "recovery", email });

  if (isUnknownUser(error)) return { status: "unknown_email" };

  // Anything else — Supabase unreachable, credentials rejected, a token that
  // came back malformed — must not be reported as "no such account", or an
  // outage would tell every visitor they are not registered.
  if (error || !link?.properties?.hashed_token) {
    console.error("Password reset link generation failed:", error?.message ?? "no token returned");
    return { status: "failed" };
  }

  const resetUrl = `${appBaseUrl()}/reset-password?token=${link.properties.hashed_token}`;
  const name = (link.user?.user_metadata?.full_name as string | undefined)?.trim() || "there";

  return {
    status: "ready",
    resetUrl,
    deliver: async () => {
      try {
        return await sendTemplatedEmail(passwordResetTemplate, { name, resetUrl }, { email, name });
      } catch (err) {
        // The caller answers the browser with this verdict, so a rejecting
        // send must be reported, not swallowed.
        console.error("Password reset email failed:", err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
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
