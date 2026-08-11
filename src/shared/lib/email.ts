/**
 * Addresses are compared case-insensitively and without surrounding space,
 * because that is how they are stored and matched everywhere else: Supabase
 * lowercases what it keeps, and the account lookup in `auth-account.ts` folds
 * case before matching. Comparing raw input instead would read "Ada@x.com" as
 * a different address from the "ada@x.com" already on the account.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Whether two addresses identify the same account. Absent is never a match. */
export function isSameEmail(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return normalizeEmail(a) === normalizeEmail(b);
}
