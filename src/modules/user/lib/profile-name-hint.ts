import { ROLES } from "@/shared/lib/roles";
import type { UserRole } from "@/shared/types";

/**
 * Where this account's name actually shows up, said per role.
 *
 * One sentence covered every role before, and it had to hedge to do it —
 * "…and, if you speak, your session pages" — which asks an attendee to work
 * out whether a clause applies to them, and still leaves a facilitator's real
 * surfaces unmentioned. The name appears in genuinely different places
 * depending on what the account can do, so the copy does too.
 *
 * A full `Record` rather than a lookup with a default: a role added to the
 * union without a line here fails the build, which is the point. Whoever adds
 * it knows where that role's name will be seen; a default would quietly give
 * them an attendee's answer.
 */
const NAME_HINTS: Record<UserRole, string> = {
  [ROLES.ATTENDEE]: "Shown on your event tickets, at check-in, and on any questions you ask.",
  [ROLES.SPEAKER]: "Shown on the session pages you speak at, on your event tickets, and on questions you ask.",
  [ROLES.FACILITATOR]: "Shown on your answers in the course room and on your replies in support chats.",
  [ROLES.ADMIN]: "Shown on your replies in support chats and against the actions your account takes.",
  [ROLES.SUPER_ADMIN]: "Shown on your replies in support chats and against the actions your account takes.",
};

/**
 * The hint for a role, or nothing at all while the session is still resolving.
 * Saying nothing beats naming the wrong surfaces for a second and then
 * swapping them out under the reader.
 */
export function profileNameHint(role?: UserRole): string | undefined {
  return role ? NAME_HINTS[role] : undefined;
}
