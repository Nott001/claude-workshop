import { clerkClient } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/db";
import type { User } from "@/types";

type SyncUserResult = Pick<User, "user_id" | "role" | "full_name" | "email"> | null;

export async function syncUser(clerkId: string): Promise<SyncUserResult> {
  const supabase = getServiceClient();

  const { data: existing } = await supabase
    .from("USERS")
    .select("user_id, role, full_name, email")
    .eq("clerk_id", clerkId)
    .single();

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

  const upsertPayload: Record<string, unknown> = {
    clerk_id: clerkId,
    email: primaryEmail,
    full_name: fullName,
  };
  if (role) {
    upsertPayload.role = role;
  }

  const { data: created, error } = await supabase
    .from("USERS")
    .upsert(upsertPayload, { onConflict: "clerk_id" })
    .select("user_id, role, full_name, email")
    .single();

  if (error || !created) {
    return null;
  }

  return created;
}
