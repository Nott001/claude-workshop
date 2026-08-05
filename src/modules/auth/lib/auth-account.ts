type AdminUser = { id: string; email: string | null; last_sign_in_at: string | null };

export type AuthAccount = {
  id: string;
  /**
   * A confirmed address is not an accepted invitation.
   *
   * Mail scanners and link prefetchers follow the verification URL on the
   * recipient's behalf, which confirms the address and spends the token while
   * nobody signs in. Signing in is the only event that proves the invitation
   * reached a person, because it is also what provisions their `USER` row.
   */
  accepted: boolean;
};

/**
 * Finds the auth account behind an email address, if there is one.
 *
 * supabase-js can only fetch an auth user by id and `auth.users` is not
 * reachable through PostgREST, so the GoTrue admin endpoint is the only lookup
 * available by address.
 */
export async function findAuthAccountByEmail(email: string): Promise<AuthAccount | null> {
  const url = new URL("/auth/v1/admin/users", process.env.NEXT_PUBLIC_SUPABASE_URL);
  // `filter` matches a substring of the address, so the exact comparison below
  // is what decides the result.
  url.searchParams.set("filter", email);

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(url, { headers: { apikey: key, Authorization: `Bearer ${key}` } });

  // Reporting "no account" on a failed lookup costs nothing: the caller goes on
  // to ask Supabase for an invitation link, which refuses for an address that
  // is already taken and produces the same conflict the caller would have.
  if (!res.ok) return null;

  const { users } = (await res.json()) as { users?: AdminUser[] };
  const match = users?.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!match) return null;

  return { id: match.id, accepted: Boolean(match.last_sign_in_at) };
}
