import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import { ensureUser } from "./ensure-user";
import type { User } from "@/shared/types";
import type { AuthUser } from "./types";

export async function getCurrentUserId(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          cookieStore.set(name, value, options);
        } catch {}
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          cookieStore.set(name, "", { ...options, maxAge: 0 });
        } catch {}
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

// getCurrentUser never guards: it resolves the current authenticated user, or
// null when anonymous. The hard guards in role-guard.ts sit on top of it.
export async function getCurrentUser(supabase?: ReturnType<typeof getServiceClient>): Promise<AuthUser | null> {
  const authUserId = await getCurrentUserId();
  if (!authUserId) return null;

  const db = supabase ?? getServiceClient();
  // findByAuthId returns the full User row, ensureUser returns the projected
  // AuthUser — only the fields common to both are read below.
  let dbUser: User | AuthUser | null = await userDao.findByAuthId(db, authUserId);
  if (!dbUser) {
    dbUser = await ensureUser(db, authUserId);
  }
  if (!dbUser) return null;
  return {
    id: dbUser.id,
    role: dbUser.role,
    full_name: dbUser.full_name,
    email: dbUser.email,
    profile_image_url: dbUser.profile_image_url,
  };
}
