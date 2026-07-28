import { getServiceClient } from "@/shared/db/client";
import { userDao } from "@/shared/db/dao";
import type { AuthUser } from "./types";

export async function ensureUser(supabase: ReturnType<typeof getServiceClient>, authUserId: string): Promise<AuthUser | null> {
  const created = await userDao.upsertUser(supabase, {
    auth_user_id: authUserId,
    email: "",
    full_name: "",
    role: "attendee",
  });

  if (!created) return null;
  return { id: created.id, role: created.role, full_name: created.full_name, email: created.email };
}
