import { getServiceClient } from "@/lib/db";
import { userDao } from "@/lib/db/dao";
import type { AuthUser } from "./types";

export async function ensureUser(supabase: ReturnType<typeof getServiceClient>, authUserId: string): Promise<AuthUser | null> {
  const exists = await userDao.findByAuthId(supabase, authUserId);
  if (exists) {
    return { id: exists.id, role: exists.role, full_name: exists.full_name, email: exists.email };
  }

  const created = await userDao.upsertFromClerk(supabase, {
    auth_user_id: authUserId,
    email: "",
    full_name: "",
    role: "attendee",
  });

  if (!created) return null;
  return { id: created.id, role: created.role, full_name: created.full_name, email: created.email };
}
