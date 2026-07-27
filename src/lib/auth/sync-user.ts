import { clerkClient } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import { userDao } from "@/lib/db/dao";
import type { User } from "@/types";

type SyncUserResult = Pick<User, "id" | "role" | "full_name" | "email"> | null;

export async function syncUser(clerkId: string): Promise<SyncUserResult> {
  const supabase = getServiceClient();

  const existing = await userDao.findByAuthId(supabase, clerkId);

  if (existing) {
    return existing;
  }

  let clerkUser;
  try {
    const client = await clerkClient();
    clerkUser = await client.users.getUser(clerkId);
  } catch {
    return null;
  }

  const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress ?? "";
  const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || primaryEmail;
  const role = typeof clerkUser.publicMetadata?.role === "string" ? clerkUser.publicMetadata.role : undefined;

  const created = await userDao.upsertFromClerk(supabase, {
    auth_user_id: clerkId,
    email: primaryEmail,
    full_name: fullName,
    ...(role ? { role } : {}),
  });

  if (!created) return null;

  return created;
}
