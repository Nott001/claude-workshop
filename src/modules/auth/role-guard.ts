import type { UserRole, User } from "@/types";
import { requireAuth } from "./session";
import type { RoleGuardResult } from "./types";

export async function requireRole(...allowedRoles: UserRole[]): Promise<RoleGuardResult> {
  const user = await requireAuth();

  if (!user) {
    return { allowed: false, error: "Unauthenticated", user: null };
  }

  if (!allowedRoles.includes(user.role as UserRole)) {
    return { allowed: false, error: "Forbidden", user: null };
  }

  return { allowed: true, error: null, user: user as Pick<User, "role"> };
}
