"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Confirms a password is the one on the account, without disturbing the session
 * the caller is already holding.
 *
 * Its own client, deliberately, and not the shared browser one: signing in on
 * that would replace the live session on every successful check, emitting
 * SIGNED_IN and sending the whole shell through a refetch to arrive back where
 * it started. This client is told not to persist or refresh anything, so it
 * never touches the `sb-<ref>-auth-token` key the shared client owns — which is
 * the race `browser-client.ts` warns about, and the reason a second client is
 * only safe while it stays out of storage.
 *
 * The session it mints is left to expire rather than signed out: `signOut`
 * defaults to revoking every session the user has, which would turn a mistyped
 * password into being logged out everywhere.
 */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { error } = await client.auth.signInWithPassword({ email, password });
  return !error;
}
