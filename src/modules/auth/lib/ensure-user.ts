import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import type { AuthUser } from "./types";

export async function ensureUser(supabase: ReturnType<typeof getServiceClient>, authUserId: string): Promise<AuthUser | null> {
  const { data: authUser } = await supabase.auth.admin.getUserById(authUserId);
  const email = authUser?.user?.email ?? "";
  const full_name = authUser?.user?.user_metadata?.full_name ?? "";

  const created = await userDao.upsertUser(supabase, {
    auth_user_id: authUserId,
    email,
    full_name,
    role: "attendee",
  });

  if (!created) return null;
  return {
    id: created.id,
    role: created.role,
    full_name: created.full_name,
    email: created.email,
    profile_image_url: created.profile_image_url,
  };
}
