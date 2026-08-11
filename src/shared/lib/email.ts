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

/** The part after the last `@`, or null if there is nothing usable there. */
export function emailDomain(email: string): string | null {
  const at = normalizeEmail(email).lastIndexOf("@");
  if (at < 1) return null;
  const domain = normalizeEmail(email).slice(at + 1);
  return domain.includes(".") ? domain : null;
}

/**
 * Domains worth keeping a list of: they cover most addresses people type, so a
 * near-miss against one is almost always a typo rather than an obscure host,
 * and an exact hit needs no lookup to know mail reaches it.
 */
const COMMON_MAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "gmx.com",
  "mail.com",
  "yandex.com",
];

export function isWellKnownMailDomain(domain: string): boolean {
  return COMMON_MAIL_DOMAINS.includes(domain);
}

/** Edit distance, capped: anything past the cap is only ever "too far". */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;

  // Two rows rather than the full matrix — the inputs are domains, but there is
  // no reason to allocate length*length for a value read one row at a time.
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  let current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let best = current[0];

    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1);
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, substitution);
      if (current[j] < best) best = current[j];
    }

    // Every later row can only grow, so a row that is already past the cap
    // settles the answer.
    if (best > cap) return cap + 1;
    [previous, current] = [current, previous];
  }

  return previous[b.length];
}

/**
 * The address the user most likely meant, when theirs is one or two slips away
 * from a domain almost everybody uses — `gmial.com`, `gmail.con`. Returns null
 * when the domain is already well known or resembles nothing on the list, so
 * an unusual but real domain is never second-guessed.
 */
export function suggestEmailCorrection(email: string): string | null {
  const domain = emailDomain(email);
  if (!domain || isWellKnownMailDomain(domain)) return null;

  // One slip is enough to go on for a short domain; two would reach domains
  // that merely rhyme with a common one.
  const cap = domain.length <= 6 ? 1 : 2;

  let best: string | null = null;
  let bestDistance = cap + 1;

  for (const candidate of COMMON_MAIL_DOMAINS) {
    const distance = editDistance(domain, candidate, cap);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  if (!best || bestDistance > cap) return null;
  return `${normalizeEmail(email).slice(0, normalizeEmail(email).lastIndexOf("@") + 1)}${best}`;
}
