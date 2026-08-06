import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import type { AuthUser } from "./types";
import { readInvitedRole } from "./invited-role";

export async function ensureUser(supabase: ReturnType<typeof getServiceClient>, authUserId: string): Promise<AuthUser | null> {
  const { data: authUser } = await supabase.auth.admin.getUserById(authUserId);
  const email = authUser?.user?.email ?? "";
  const full_name = authUser?.user?.user_metadata?.full_name ?? "";

  // An organization invite records the granted role in app_metadata, which only
  // the service role can write. Anyone who signed up for themselves has none
  // and stays an attendee.
  const invitedRole = readInvitedRole(authUser?.user?.app_metadata);

  const created = await userDao.upsertUser(supabase, {
    auth_user_id: authUserId,
    email,
    full_name,
    role: invitedRole ?? "attendee",
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
