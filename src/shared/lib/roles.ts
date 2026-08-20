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

/**
 * Every role, in the same order as the `UserRole` union — least authority
 * first, which is also the order `user_role` is declared in the database.
 *
 * That agreement is load-bearing, not cosmetic: Postgres sorts an enum by
 * declaration order, and the user roster sorts staff with `ORDER BY
 * role DESC`. Adding a role means adding it here, in `ROLE_LEVEL`, and to the
 * enum with an explicit `BEFORE`/`AFTER` — a bare `ADD VALUE` lands at the end
 * of the sort order and the new role opens the roster as its most senior
 * member. `test/role-enum-order.test.ts` fails when the two stop matching.
 */
export const ALL_ROLES: readonly UserRole[] = [
  ROLES.ATTENDEE,
  ROLES.SPEAKER,
  ROLES.FACILITATOR,
  ROLES.ADMIN,
  ROLES.SUPER_ADMIN,
];

/** The roles an admin can hand out through a user invite. */
export const INVITABLE_ROLES = [ROLES.SPEAKER, ROLES.FACILITATOR, ROLES.ADMIN] as const;

export type InvitableRole = (typeof INVITABLE_ROLES)[number];

/**
 * The roles an existing account can be moved between.
 *
 * Wider than `INVITABLE_ROLES` because it includes `attendee`: an invitation
 * creates a member, while this set also has to express demoting one back to the
 * role everybody starts in.
 *
 * `super_admin` is absent on purpose. It is the role that decides who else may
 * hold `admin`, so an endpoint that could assign it would let the holders of a
 * lesser role mint their own superiors. It is granted in the database.
 */
export const ASSIGNABLE_ROLES = [ROLES.ATTENDEE, ROLES.SPEAKER, ROLES.FACILITATOR, ROLES.ADMIN] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** The roles that staff a listing, in roster display order. */
export const STAFF_ROLES = [ROLES.FACILITATOR, ROLES.SPEAKER, ROLES.ADMIN, ROLES.SUPER_ADMIN] as const;
