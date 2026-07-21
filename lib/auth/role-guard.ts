import { auth } from "@clerk/nextjs/server";
import type { UserRole, User } from "@/types";
import { syncUser } from "@/lib/auth/sync-user";

type RoleGuardResult =
  | { allowed: true; error: null; user: Pick<User, "role"> }
  | { allowed: false; error: "Unauthenticated" | "Forbidden"; user: null };

export async function requireRole(...allowedRoles: UserRole[]): Promise<RoleGuardResult> {
  const { userId } = await auth();

  if (!userId) {
    return { allowed: false, error: "Unauthenticated", user: null };
  }

  const dbUser = await syncUser(userId);

  if (!dbUser || !allowedRoles.includes(dbUser.role as UserRole)) {
    return { allowed: false, error: "Forbidden", user: null };
  }

  return { allowed: true, error: null, user: dbUser as Pick<User, "role"> };
}
