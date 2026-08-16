/**
 * Turns a provider auth error into copy a user can act on. supabase-js builds
 * `AuthError.message` from the response body's `msg`/`message`/`error`
 * fields and, failing all of them, from `JSON.stringify(body)` — so a 4xx body
 * that is `{}` (or carries only a numeric `code`) arrives as the literal
 * `"{}"`, which a toast or field renders as `{ }`.
 *
 * The two failures worth predicting are the rate limit (429, an hourly window
 * where an immediate retry is exactly what the provider punishes) and the
 * unparseable body. Everything else that looks like real provider copy —
 * "Email already in use", a password rule — carries more signal than our
 * fallback and survives. The caller supplies the fallback so it fits the action.
 */
export function authErrorMessage(error: { message: string; status?: number }, fallback: string): string {
  if (error.status === 429) return "Too many attempts. Please wait, then try again.";

  const message = error.message.trim();
  if (message.length > 1 && message !== "{}") return message;

  return fallback;
}
