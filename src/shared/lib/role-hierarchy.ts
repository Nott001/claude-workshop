import type { UserRole } from "@/shared/types";

const ROLE_LEVEL: Record<UserRole, number> = {
  attendee: 10,
  speaker: 20,
  facilitator: 30,
  admin: 40,
  super_admin: 50,
};

export function hasMinRole(actual: UserRole | null, required: UserRole): boolean {
  if (!actual) return false;
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[required];
}

/**
 * Whether one role may hand out another.
 *
 * Strictly greater, where `hasMinRole` is greater-or-equal: a role you merely
 * hold is a role you could give away, and an admin minting admins is how one
 * compromised account becomes several. The invite form, the role picker and
 * both write paths ask this same question, so it is answered once — four copies
 * of it were four chances for the UI to offer what the server refuses.
 */
export function canGrantRole(actor: UserRole | null, granted: UserRole): boolean {
  if (!actor) return false;
  return ROLE_LEVEL[actor] > ROLE_LEVEL[granted];
}
