import type { UserRole } from "@/shared/types";
import { INVITABLE_ROLES, type InvitableRole } from "@/shared/lib/roles";

export { INVITABLE_ROLES };
export type { InvitableRole };

/**
 * The invited role travels in `app_metadata`, never `user_metadata`.
 *
 * A signed-in user can rewrite their own `user_metadata` with
 * `supabase.auth.updateUser({ data })`, so trusting a role from there would let
 * any attendee promote themselves to admin. `app_metadata` is writable only by
 * the service role, which is why authorization data belongs there.
 */
export const INVITED_ROLE_KEY = "invited_role";

/**
 * Re-validates on the way out rather than trusting the stored value: this is
 * the boundary where a string becomes a privilege, and `super_admin` must never
 * be obtainable through an invite even if something wrote it.
 */
export function readInvitedRole(appMetadata: unknown): UserRole | null {
  if (!appMetadata || typeof appMetadata !== "object") return null;

  const value = (appMetadata as Record<string, unknown>)[INVITED_ROLE_KEY];
  return INVITABLE_ROLES.includes(value as InvitableRole) ? (value as UserRole) : null;
}
