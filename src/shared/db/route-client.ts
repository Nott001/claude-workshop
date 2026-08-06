import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * The anon-key client for a route handler, bound to the request's cookies so a
 * session it establishes lands on the response.
 *
 * `getAll`/`setAll` rather than the per-cookie accessors: an auth token is
 * chunked across several cookies, and writing them one at a time is what once
 * left browsers holding half a session.
 */
export async function getRouteClient() {
  const cookieStore = await cookies();

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}
