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

// Auth fully off. On a non-browser runtime GoTrue arms a 30s auto-refresh
// interval it never clears, and that timer roots the whole client graph —
// GoTrueClient holds the auth-state emitter, which holds the SupabaseClient —
// so a client built per request is retained for the life of the process.
function createServiceClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

// Wrapped rather than annotated so callers keep the generics `createClient`
// infers; naming the type collapses them and untyped `.from()` rows become `never`.
let serviceClient: ReturnType<typeof createServiceClient> | null = null;

// One per isolate. A service-role client holds no per-user state — no cookies,
// no session — so sharing it across requests is safe. Resolved on first use so
// the Worker env is populated by then.
export function getServiceClient() {
  serviceClient ??= createServiceClient();
  return serviceClient;
}
