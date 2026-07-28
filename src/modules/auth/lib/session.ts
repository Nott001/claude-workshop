import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getServiceClient } from "@/shared/db/client";
import { userDao } from "@/shared/db/dao";
import { ensureUser } from "./ensure-user";
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
          cookieStore.delete(name, options);
        } catch {}
      },
    },
  });
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function requireAuth(supabase?: ReturnType<typeof getServiceClient>): Promise<AuthUser | null> {
  const authUserId = await getCurrentUserId();
  if (!authUserId) return null;

  const db = supabase ?? getServiceClient();
  let dbUser = await userDao.findByAuthId(db, authUserId);
  if (!dbUser) {
    dbUser = await ensureUser(db, authUserId);
  }
  if (!dbUser) return null;
  return { id: dbUser.id, role: dbUser.role, full_name: dbUser.full_name, email: dbUser.email };
}
