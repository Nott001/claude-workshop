import { ROLES } from "@/shared/lib/roles";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";

/**
 * Whether the caller may act as staff in a chat panel. The server moderates
 * support and QA by conversation role and course assignment on top of this;
 * the client uses one floor so the three panels do not drift into two policies.
 */
export function isChatStaff(role: UserRole | null | undefined): boolean {
  return hasMinRole(role ?? null, ROLES.FACILITATOR);
}
