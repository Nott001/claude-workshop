import { createBrowserClient } from "@supabase/ssr";
import type { DbClient } from "./dao/types";

// The client for anything running in the browser. createBrowserClient caches a
// singleton per browser context, so this returns the same instance the auth code
// already uses and there is exactly one GoTrueClient on the page.
//
// Client components must not import `supabase` from ./client: that one is a
// plain supabase-js client with its own GoTrueClient, and two of them against
// the same `sb-<ref>-auth-token` storage key race on token refresh. auth-js
// only serialises refreshes when a lock is passed explicitly, and neither
// client passes one.
export function getBrowserClient(): DbClient {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
