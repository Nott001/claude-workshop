/** Supabase's hashed_token: opaque, but always URL-safe and of bounded length. */
const TOKEN = /^[A-Za-z0-9_-]{16,256}$/;

export function isInviteToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN.test(value);
}
