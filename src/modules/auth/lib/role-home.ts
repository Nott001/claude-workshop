import type { UserRole } from "@/shared/types";

/** The landing page a user with each role is routed to after sign-in. */
export const ROLE_HOME: Record<UserRole, string> = {
  attendee: "/home",
  speaker: "/speaker/dashboard",
  facilitator: "/staff/events/assigned",
  admin: "/staff/events",
  super_admin: "/staff/events",
};

export function roleHome(role: string | null | undefined): string {
  return (role && ROLE_HOME[role as UserRole]) || "/";
}
