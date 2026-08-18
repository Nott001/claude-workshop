/**
 * Seconds GoTrue named in a rate-limit refusal, or null when it named none.
 *
 * Its minimum-interval refusal puts the wait in the message and nowhere else —
 * "For security purposes, you can only request this after 41 seconds." (older
 * builds: "...once every 60 seconds"). There is no `Retry-After` header on the
 * response and no field for it on `AuthError`, so the sentence is the only
 * copy of the number that reaches us. Discarding it, as the 429 branch below
 * used to, is what left a refusal with a known wait reading as an open-ended
 * one.
 *
 * The hourly budget ("email rate limit exceeded") carries no number, and no
 * regex can invent one — that case is answered by code instead.
 */
export function rateLimitSecondsFrom(message: string): number | null {
  const match = /(\d+)\s*seconds?/i.exec(message);
  if (!match) return null;

  const seconds = Number(match[1]);
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

/** "45 seconds", "1 minute" — the wait as a reader would say it. */
function describeWait(seconds: number): string {
  if (seconds < 60) return `${seconds} second${seconds === 1 ? "" : "s"}`;

  // Rounded up: a wait described as shorter than it is buys a second refusal.
  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}

/**
 * Turns a provider auth error into copy a user can act on. supabase-js builds
 * `AuthError.message` from the response body's `msg`/`message`/`error`
 * fields and, failing all of them, from `JSON.stringify(body)` — so a 4xx body
 * that is `{}` (or carries only a numeric `code`) arrives as the literal
 * `"{}"`, which a toast or field renders as `{ }`.
 *
 * The two failures worth predicting are the rate limit (429) and the
 * unparseable body. Everything else that looks like real provider copy —
 * "Email already in use", a password rule — carries more signal than our
 * fallback and survives. The caller supplies the fallback so it fits the action.
 */
export function authErrorMessage(
  error: { message: string; status?: number; retryAfter?: number; code?: string },
  fallback: string,
): string {
  if (error.status === 429) {
    // Our own cooldown states the wait outright; the provider only ever spells
    // it into prose. Either way the number is what the reader needs, because
    // "please wait" reads the same at forty seconds as at an hour.
    const seconds = error.retryAfter && error.retryAfter > 0 ? error.retryAfter : rateLimitSecondsFrom(error.message);
    if (seconds) return `Too many attempts. Try again in ${describeWait(seconds)}.`;

    // No number anywhere: the project's hourly send budget is spent. That
    // budget is per project, not per user (`email_sent` in
    // `supabase/config.toml`), so this refuses accounts that have sent nothing
    // at all — a signed-in-yesterday user, a fresh signup — and copy that reads
    // as "you did this" sends them looking for a limit of their own that does
    // not exist. Neither does GoTrue report when the window rolls, so there is
    // no honest countdown to offer here; saying which limit it is at least
    // explains why waiting a minute changes nothing.
    if (error.code === "over_email_send_rate_limit") {
      return "The app has reached its hourly limit for sending emails, which every account shares. Please try again later.";
    }

    return "Too many attempts. Please wait, then try again.";
  }

  const message = error.message.trim();
  if (message.length > 1 && message !== "{}") return message;

  return fallback;
}
