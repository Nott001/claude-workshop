/** Supabase's hashed_token: opaque, but always URL-safe and of bounded length. */
const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;

/**
 * Shared by the invitation and password-reset links: `generateLink` mints the
 * same token shape for every type, and both flows need to reject a malformed
 * one before it reaches `verifyOtp`.
 */
export function isAuthToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN.test(value);
}
