import type { UserRole } from "@/shared/types";
import { requireAuth } from "./session";
import type { RoleGuardResult } from "./types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

export async function requireRole(...allowedRoles: UserRole[]): Promise<RoleGuardResult> {
  const user = await requireAuth();

  if (!user) {
    return { allowed: false, error: "Unauthenticated", user: null };
  }

  if (allowedRoles.length > 0 && !allowedRoles.some((r) => hasMinRole(user.role as UserRole, r))) {
    return { allowed: false, error: "Forbidden", user: null };
  }

  return { allowed: true, error: null, user };
}
