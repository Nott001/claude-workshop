import type { User } from "@/shared/types";

export type AuthUser = Pick<User, "id" | "role" | "full_name" | "email">;

export type RoleGuardResult =
  { allowed: true; error: null; user: AuthUser } | { allowed: false; error: "Unauthenticated" | "Forbidden"; user: null };
