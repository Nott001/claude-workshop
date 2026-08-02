import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Server-side anonymous reads only — public data under RLS, no user session.
// Auth is off so this never becomes a second GoTrueClient competing with the
// browser client for the `sb-<ref>-auth-token` storage key. Anything running in
// the browser must use getBrowserClient() from ./browser-client instead.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export function getServiceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}
