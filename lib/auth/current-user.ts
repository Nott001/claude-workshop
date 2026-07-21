import { auth } from "@clerk/nextjs/server";
import { syncUser } from "@/lib/auth/sync-user";
import type { User } from "@/types";

type CurrentUser = Pick<User, "user_id" | "role" | "full_name" | "email">;

export async function currentUser(): Promise<CurrentUser | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return syncUser(userId);
}
