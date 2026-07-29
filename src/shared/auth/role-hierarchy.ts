import type { UserRole } from "@/shared/types";

const ROLE_LEVEL: Record<UserRole, number> = {
  attendee: 10,
  speaker: 20,
  facilitator: 30,
  admin: 40,
  super_admin: 50,
};

export function hasMinRole(actual: UserRole | null, required: UserRole): boolean {
  if (!actual) return false;
  return ROLE_LEVEL[actual] >= ROLE_LEVEL[required];
}
