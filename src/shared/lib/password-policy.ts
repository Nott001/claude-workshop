import { COMMON_PASSWORD_WORDS } from "./common-passwords";

/**
 * NIST SP 800-63B, which asks for length and screening rather than composition.
 * Requiring a symbol and a digit reliably produces `Password1!` — compliant,
 * memorised nowhere, and near the top of every breach list — so the rules below
 * set a floor, screen what people actually pick, and otherwise stay out of the
 * way. Spaces and every other character are allowed on purpose.
 */
export const MIN_PASSWORD_LENGTH = 12;

/**
 * A comfortable ceiling to state in the form. Characters, so it reads the way a
 * person counts, which is why it cannot be the only ceiling — see below.
 */
export const MAX_PASSWORD_LENGTH = 64;

/**
 * bcrypt, which is what Supabase hashes with, does not consider anything past
 * 72 bytes of the password.
 *
 * Bytes, and measured as such: `String.length` counts UTF-16 code units, so a
 * passphrase well inside 64 of those can be far past 72 bytes once encoded —
 * 32 emoji are 64 code units and 128 bytes, and 24 CJK characters are already
 * 72. Judged by length alone, the tail of such a passphrase would be quietly
 * disregarded and the user would believe they had set something longer than
 * they had.
 */
export const MAX_PASSWORD_BYTES = 72;

export type PasswordRuleId = "length" | "maximum" | "not-common" | "no-runs" | "not-personal";

export interface PasswordRule {
  id: PasswordRuleId;
  /** Phrased as the requirement, so it reads the same met or unmet. */
  label: string;
  passed: boolean;
}

export interface PasswordVerdict {
  ok: boolean;
  rules: PasswordRule[];
  /** The first unmet requirement, ready to show as the error. */
  problem: string | null;
}

export interface PasswordContext {
  email?: string | null;
  fullName?: string | null;
}

const LEET: Record<string, string> = {
  "0": "o",
  "1": "l",
  "3": "e",
  "4": "a",
  "5": "s",
  "7": "t",
  "8": "b",
  "@": "a",
  $: "s",
  "!": "i",
};

function unleet(value: string): string {
  return value.replace(/[0134578@$!]/g, (c) => LEET[c] ?? c).replace(/[^a-z]/g, "");
}

/**
 * The words someone might have been thinking of when they chose this.
 *
 * More than one reduction, because the two habits fight each other: `p4ssw0rd`
 * wants its digits read as letters, while the `1234` glued to the end of
 * `password1234` wants them dropped. Trimming the decoration before reading the
 * rest as letters satisfies both, and the untrimmed form is kept for a password
 * that opens with a symbol standing in for a letter, as `$unshine` does.
 */
function cores(password: string): string[] {
  const lower = password.toLowerCase();
  const trailingTrimmed = lower.replace(/[^a-z]+$/, "");
  const bothTrimmed = trailingTrimmed.replace(/^[^a-z]+/, "");

  return [unleet(lower), unleet(trailingTrimmed), unleet(bothTrimmed)];
}

const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
const RUN_LENGTH = 6;

/** A stretch long enough to be typed without being chosen: `123456`, `qwerty`, `aaaaaa`. */
function hasRun(password: string): boolean {
  const value = password.toLowerCase();

  if (/(.)\1{4,}/.test(value)) return true;

  for (let i = 0; i + RUN_LENGTH <= value.length; i++) {
    const window = value.slice(i, i + RUN_LENGTH);

    let ascending = true;
    let descending = true;
    for (let j = 1; j < window.length; j++) {
      const step = window.charCodeAt(j) - window.charCodeAt(j - 1);
      if (step !== 1) ascending = false;
      if (step !== -1) descending = false;
    }
    if (ascending || descending) return true;

    if (KEYBOARD_ROWS.some((row) => row.includes(window) || [...row].reverse().join("").includes(window))) {
      return true;
    }
  }

  return false;
}

/** Words from the user's own account, which an attacker targeting them starts with. */
function personalWords({ email, fullName }: PasswordContext): string[] {
  const local = email?.split("@")[0] ?? "";
  return [local, ...(fullName ?? "").split(/\s+/)]
    .map((part) => part.toLowerCase().replace(/[^a-z]/g, ""))
    .filter((part) => part.length >= 4);
}

/**
 * How much of the password the account's own words account for.
 *
 * Proportion rather than mere presence, because the two cases a bare "contains
 * your name" test cannot tell apart deserve opposite answers: a password that
 * *is* the name is the guess an attacker targeting this person makes first,
 * while a name that merely appears inside a long passphrase — `the bell tolls
 * at dawn`, for someone called Bell — is a coincidence, and refusing it teaches
 * people that the rules are arbitrary. The longest single match decides it, so
 * overlapping words like an email local part and a surname cannot be counted
 * twice against the same letters.
 */
function personalShare(reduced: string[], context: PasswordContext): number {
  const words = personalWords(context);
  let share = 0;

  for (const candidate of reduced) {
    if (!candidate) continue;
    for (const word of words) {
      if (candidate.includes(word)) share = Math.max(share, word.length / candidate.length);
    }
  }

  return share;
}

/** Half. Past this the account's own words are not in the password, they are it. */
const PERSONAL_SHARE_LIMIT = 0.5;

/**
 * Every rule, each with whether this password meets it, so the form can list
 * them as the user types and the server can refuse on exactly the same answer.
 */
export function evaluatePassword(password: string, context: PasswordContext = {}): PasswordVerdict {
  const reduced = cores(password);
  const bytes = new TextEncoder().encode(password).length;

  const rules: PasswordRule[] = [
    {
      id: "length",
      label: `At least ${MIN_PASSWORD_LENGTH} characters`,
      passed: password.length >= MIN_PASSWORD_LENGTH,
    },
    {
      id: "maximum",
      // Named for whichever ceiling is the binding one, so a passphrase in a
      // non-Latin script is not refused by a message about a character count it
      // is comfortably inside.
      label:
        bytes > MAX_PASSWORD_BYTES
          ? "Short enough for the password to be stored whole"
          : `No more than ${MAX_PASSWORD_LENGTH} characters`,
      passed: password.length <= MAX_PASSWORD_LENGTH && bytes <= MAX_PASSWORD_BYTES,
    },
    {
      id: "not-common",
      label: "Not built on a commonly used password",
      passed: !reduced.some((word) => word.length >= 4 && COMMON_PASSWORD_WORDS.has(word)),
    },
    {
      id: "no-runs",
      label: "No long runs like 123456 or qwerty",
      passed: !hasRun(password),
    },
    {
      id: "not-personal",
      label: "Not mostly your name or email address",
      passed: personalShare(reduced, context) < PERSONAL_SHARE_LIMIT,
    },
  ];

  const failed = rules.find((rule) => !rule.passed);
  return { ok: !failed, rules, problem: failed ? failed.label : null };
}
