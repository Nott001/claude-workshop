import type { UserRole } from "@/shared/types";

/**
 * The role set, keyed for dot-access at every call site.
 *
 * The value of each key is deliberately repeated rather than computed: `as
 * const` needs the literal types to line up with the `UserRole` union, and
 * spelling them here keeps the definition greppable.
 */
export const ROLES = {
  ATTENDEE: "attendee",
  SPEAKER: "speaker",
  FACILITATOR: "facilitator",
  ADMIN: "admin",
  SUPER_ADMIN: "super_admin",
} as const;

/** Every role, in the same order as the `UserRole` union. */
export const ALL_ROLES: readonly UserRole[] = [
  ROLES.ATTENDEE,
  ROLES.SPEAKER,
  ROLES.FACILITATOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

/** The roles an admin can hand out through the organization invite. */
export const INVITABLE_ROLES = [ROLES.SPEAKER, ROLES.FACILITATOR, ROLES.ADMIN] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/** The roles that staff a listing, in roster display order. */
export const STAFF_ROLES = [ROLES.FACILITATOR, ROLES.SPEAKER, ROLES.ADMIN, ROLES.SUPER_ADMIN] as const;
