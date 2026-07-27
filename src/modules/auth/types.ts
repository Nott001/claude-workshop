import type { User } from "@/types";

export type AuthUser = Pick<User, "id" | "role" | "full_name" | "email">;

export type RoleGuardResult =
  | { allowed: true; error: null; user: Pick<User, "role"> }
  | { allowed: false; error: "Unauthenticated" | "Forbidden"; user: null };
