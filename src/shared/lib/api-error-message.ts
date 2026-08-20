/**
 * Reads an API error body regardless of the envelope it shipped in. Routes now
 * answer one flat `{ error: string }`, but a pre-deploy client may hit the old
 * nested `{ error: { message } }` during the transition, so readers go through
 * this to tolerate both.
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  const error = (body as { error?: string | { message?: string } } | null)?.error;
  if (typeof error === "string") return error;
  return error?.message ?? fallback;
}
