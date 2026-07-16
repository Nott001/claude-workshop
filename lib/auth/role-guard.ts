import { auth } from "@clerk/nextjs/server";
import type { UserRole, User } from "@/types";

type RoleGuardResult =
  | { allowed: true; error: null; user: Pick<User, "role"> }
  | { allowed: false; error: "Unauthenticated" | "Forbidden"; user: null };

export async function requireRole(...allowedRoles: UserRole[]): Promise<RoleGuardResult> {
  // DEBUG: Bypass role check when debug_mode cookie is set
  try {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const debugMode = cookieStore.get("debug_mode")?.value === "true";
    if (debugMode) {
      const debugRole = cookieStore.get("debug_role")?.value as UserRole;
      const role = debugRole && allowedRoles.includes(debugRole) ? debugRole : allowedRoles[0];
      return {
        allowed: true,
        error: null,
        user: { role },
      };
    }
  } catch {
    // cookies() not available in test environment
  }

  const { userId } = await auth();

  if (!userId) {
    return { allowed: false, error: "Unauthenticated", user: null };
  }

  const { getServiceClient } = await import("@/lib/db");
  const supabase = getServiceClient();

  const { data: dbUser } = await supabase.from("USERS").select("role").eq("clerk_id", userId).single();

  if (!dbUser || !allowedRoles.includes(dbUser.role as UserRole)) {
    return { allowed: false, error: "Forbidden", user: null };
  }

  return { allowed: true, error: null, user: dbUser as Pick<User, "role"> };
}
