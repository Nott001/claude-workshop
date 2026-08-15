import { describe, it, expect } from "vitest";
import { evaluatePassword, MAX_PASSWORD_BYTES, MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/shared/lib/password-policy";

/** The id of every rule this password fails. */
function failures(password: string, context = {}) {
  return evaluatePassword(password, context)
    .rules.filter((rule) => !rule.passed)
    .map((rule) => rule.id);
}

describe("password length", () => {
  // The bug this exists for: a single character was a valid password.
  it("refuses anything under the floor, one character included", () => {
    for (const password of ["a", "1", "short", "elevenchars"]) {
      expect(evaluatePassword(password).ok).toBe(false);
      expect(failures(password)).toContain("length");
    }
  });

  it("accepts a passphrase at the floor and beyond", () => {
    expect(evaluatePassword("a".repeat(MIN_PASSWORD_LENGTH)).rules.find((r) => r.id === "length")?.passed).toBe(true);
    expect(evaluatePassword("thoroughly unguessable phrase").ok).toBe(true);
  });

  it("refuses more than bcrypt will actually hash", () => {
    expect(failures("z" + "unguessable phrase ".repeat(10))).toContain("maximum");
    expect(evaluatePassword("q".repeat(MAX_PASSWORD_LENGTH)).rules.find((r) => r.id === "maximum")?.passed).toBe(true);
  });

  it("does not require an uppercase, a digit or a symbol", () => {
    expect(evaluatePassword("verandah tapestry").ok).toBe(true);
  });

  // String.length counts UTF-16 code units, so a passphrase inside the
  // character ceiling can still be past what bcrypt will hash — and the tail
  // would be dropped without anyone being told.
  it("measures the ceiling in bytes, not in code units", () => {
    const emoji = "\u{1F510}".repeat(32);
    expect(emoji.length).toBeLessThanOrEqual(MAX_PASSWORD_LENGTH);
    expect(new TextEncoder().encode(emoji).length).toBeGreaterThan(MAX_PASSWORD_BYTES);
    expect(failures(emoji)).toContain("maximum");
  });

  it("refuses a non-latin passphrase that crosses the byte ceiling", () => {
    const cjk = "静かな水音と遠い汽笛と朝の珈琲".repeat(2);
    expect(new TextEncoder().encode(cjk).length).toBeGreaterThan(MAX_PASSWORD_BYTES);
    expect(failures(cjk)).toContain("maximum");
  });

  it("names the byte ceiling rather than a character count it is inside", () => {
    const verdict = evaluatePassword("\u{1F510}".repeat(32));

    expect(verdict.problem).toBe("Short enough for the password to be stored whole");
  });

  it("still accepts a non-latin passphrase that fits", () => {
    expect(evaluatePassword("静かな水音と遠い汽笛と朝の珈琲").ok).toBe(true);
  });

  it("allows spaces and non-latin characters rather than stripping them", () => {
    expect(evaluatePassword("私のパスワードはとても長い").ok).toBe(true);
    expect(evaluatePassword("   spaced out phrase   ").ok).toBe(true);
  });
});

describe("common-password screening", () => {
  // Length alone lets these through, which is the whole reason for the list.
  it("refuses a common word wearing decoration that satisfies the length rule", () => {
    for (const password of ["password1234", "P@ssw0rd!123", "monkey123456", "sunshine1234"]) {
      expect(failures(password)).toContain("not-common");
    }
  });

  it("sees through leetspeak to the word underneath", () => {
    expect(failures("p4ssw0rd1234")).toContain("not-common");
    expect(failures("$un$hine1234")).toContain("not-common");
  });

  it("leaves an ordinary phrase alone, however plain its words", () => {
    for (const password of ["correct horse battery staple", "the quiet kettle sings"]) {
      expect(evaluatePassword(password).ok).toBe(true);
    }
  });
});

describe("runs", () => {
  it("refuses counted and alphabetical stretches", () => {
    expect(failures("abcdefghijkl")).toContain("no-runs");
    expect(failures("home123456789")).toContain("no-runs");
    expect(failures("987654321home")).toContain("no-runs");
  });

  it("refuses a walk along the keyboard", () => {
    expect(failures("qwertyuiop12")).toContain("no-runs");
    expect(failures("home asdfghjkl")).toContain("no-runs");
  });

  it("refuses one character held down", () => {
    expect(failures("aaaaaaaaaaaaa")).toContain("no-runs");
  });

  it("allows a short ascending stretch inside a real phrase", () => {
    expect(evaluatePassword("my 3rd kettle whistles").ok).toBe(true);
  });
});

describe("the user's own details", () => {
  const context = { email: "ada.lovelace@example.com", fullName: "Ada Lovelace" };

  it("refuses a password that is essentially the name itself", () => {
    expect(failures("adalovelace99", context)).toContain("not-personal");
    expect(failures("ada.lovelace2026", context)).toContain("not-personal");
    expect(failures("my lovelace kettle", context)).toContain("not-personal");
  });

  // A surname inside a long passphrase is a coincidence, and refusing it only
  // teaches people that the rules are arbitrary.
  it("allows a name that merely appears inside a longer passphrase", () => {
    expect(evaluatePassword("the bell tolls at dawn", { fullName: "Ada Bell" }).ok).toBe(true);
    expect(evaluatePassword("lovelace kettle brew whistles", context).ok).toBe(true);
  });

  it("counts overlapping personal words once rather than against the same letters twice", () => {
    // "ada", "lovelace" and "adalovelace" all describe the same person; the
    // longest single match is what decides it.
    expect(evaluatePassword("lovelace kettle brew whistles", context).rules.find((r) => r.id === "not-personal")?.passed).toBe(
      true,
    );
  });

  it("has nothing to say when there is no account context", () => {
    expect(evaluatePassword("adalovelace99").ok).toBe(true);
  });

  it("ignores fragments too short to mean anything", () => {
    expect(evaluatePassword("the quiet kettle", { email: "ab@example.com" }).ok).toBe(true);
  });
});

describe("the verdict", () => {
  it("names the first unmet requirement so a form has something to show", () => {
    expect(evaluatePassword("abc").problem).toBe(`At least ${MIN_PASSWORD_LENGTH} characters`);
    expect(evaluatePassword("password1234").problem).toBe("Not built on a commonly used password");
  });

  it("reports every rule either way, so a checklist can render from it", () => {
    const verdict = evaluatePassword("the quiet kettle sings");

    expect(verdict.rules).toHaveLength(5);
    expect(verdict.rules.every((rule) => rule.passed)).toBe(true);
    expect(verdict.problem).toBeNull();
  });
});
