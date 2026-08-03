"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";
import { useSession } from "../components/session-context";

export interface ClientRoleGuard {
  role: UserRole | null;
  /** The session resolved to a user who clears `minRole`. */
  allowed: boolean;
  /**
   * The session has not resolved yet — render a placeholder, never a denial.
   * Strictly `loading`: "resolved to nobody" is an answer, and treating it as
   * pending leaves the page spinning forever when `/api/auth/me` returns no
   * user for a session the middleware already let through.
   */
  pending: boolean;
}

/**
 * Client-side role gate for a guarded page.
 *
 * Only a *signed-in* user can be denied. Missing session is not a denial: the
 * middleware turns an anonymous request for a guarded route into a sign-in
 * redirect before this ever renders, so the only way to reach here without a
 * user is a sign-out on a page that is still mounted while the navigation away
 * from it runs. Sending that to /access-denied told people who had just logged
 * out that they lacked permission.
 */
export function useRoleGuard(minRole: UserRole): ClientRoleGuard {
  const router = useRouter();
  const { user, loading } = useSession();

  const role = (user?.role as UserRole | undefined) ?? null;
  const allowed = !!user && hasMinRole(role, minRole);

  useEffect(() => {
    if (loading || !user) return;
    if (!hasMinRole((user.role as UserRole | undefined) ?? null, minRole)) {
      router.replace("/access-denied");
    }
  }, [loading, user, minRole, router]);

  return { role, allowed, pending: loading };
}
