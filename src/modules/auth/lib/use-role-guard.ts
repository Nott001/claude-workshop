"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import type { UserRole } from "@/shared/types";
import { useSession } from "../components/session-context";

export interface RoleGuardOptions {
  /** Where to send a signed-in user who fails the check. Defaults to /access-denied. */
  redirectTo?: string;
  /**
   * Require the role to equal `minRole` exactly rather than "at or above" it.
   * The staff event list and the facilitator's assigned list bounce each other:
   * an admin passes a facilitator minimum, so only an exact match keeps them off
   * a page whose server payload does not scope to their own events.
   */
  exactRole?: boolean;
}

export interface ClientRoleGuard {
  role: UserRole | null;
  /** The session resolved to a user who clears the check. */
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
export function useRoleGuard(minRole: UserRole, options?: RoleGuardOptions): ClientRoleGuard {
  const router = useRouter();
  const { user, loading } = useSession();

  const role = (user?.role as UserRole | undefined) ?? null;
  const allowed = !!user && passes(user?.role as UserRole | undefined, minRole, options?.exactRole);

  useEffect(() => {
    if (loading || !user) return;
    if (!passes(user.role as UserRole | undefined, minRole, options?.exactRole)) {
      router.replace(options?.redirectTo ?? "/access-denied");
    }
    // options is a fresh object per render; only its fields matter.
  }, [loading, user, minRole, router, options?.redirectTo, options?.exactRole]);

  return { role, allowed, pending: loading };
}

function passes(actual: UserRole | undefined, minRole: UserRole, exactRole?: boolean): boolean {
  if (!actual) return false;
  return exactRole ? actual === minRole : hasMinRole(actual, minRole);
}
