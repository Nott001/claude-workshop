import type { UserRole } from "@/shared/types";
import { getCurrentUser } from "./session";
import type { AuthGuardResult } from "./types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

// The two guards split by intent. "At least this level" (staff checks) admits
// everyone above the floor; "exactly one of these" is for resources a higher
// role must not reach. They were one variadic min-role check before, so a list
// like (attendee, facilitator) silently admitted every authenticated role.
export async function requireMinRole(role: UserRole): Promise<AuthGuardResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { allowed: false, error: "Unauthenticated", user: null };
  }

  if (!hasMinRole(user.role, role)) {
    return { allowed: false, error: "Forbidden", user: null };
  }

  return { allowed: true, error: null, user };
}

export async function requireRole(...allowedRoles: UserRole[]): Promise<AuthGuardResult> {
  const user = await getCurrentUser();

  if (!user) {
    return { allowed: false, error: "Unauthenticated", user: null };
  }

  // An empty list means any authenticated caller.
  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { allowed: false, error: "Forbidden", user: null };
  }

  return { allowed: true, error: null, user };
}
