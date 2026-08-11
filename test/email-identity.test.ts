import { describe, it, expect } from "vitest";
import { emailDomain, isSameEmail, normalizeEmail, suggestEmailCorrection } from "@/shared/lib/email";

describe("normalizeEmail", () => {
  it("folds case and trims surrounding space", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

describe("isSameEmail", () => {
  it("matches the same address written differently", () => {
    expect(isSameEmail("ada@example.com", "ada@example.com")).toBe(true);
    expect(isSameEmail("Ada@Example.com", "ada@example.com")).toBe(true);
    expect(isSameEmail("  ada@example.com  ", "ada@example.com")).toBe(true);
  });

  it("separates addresses that differ anywhere that counts", () => {
    expect(isSameEmail("ada@example.com", "ada@example.org")).toBe(false);
    expect(isSameEmail("ada@example.com", "grace@example.com")).toBe(false);
    // A plus-tag is a distinct address to the provider, so it is a real change.
    expect(isSameEmail("ada+work@example.com", "ada@example.com")).toBe(false);
  });

  it("treats a missing address as no match rather than as equal", () => {
    expect(isSameEmail(null, null)).toBe(false);
    expect(isSameEmail(undefined, "ada@example.com")).toBe(false);
    expect(isSameEmail("ada@example.com", "")).toBe(false);
  });
});

describe("emailDomain", () => {
  it("reads the part after the last @, folded", () => {
    expect(emailDomain("Ada@Example.COM")).toBe("example.com");
    expect(emailDomain("ada@sub.example.co.uk")).toBe("sub.example.co.uk");
  });

  it("returns null when there is no usable domain", () => {
    expect(emailDomain("ada")).toBeNull();
    expect(emailDomain("@example.com")).toBeNull();
    expect(emailDomain("ada@localhost")).toBeNull();
  });
});

describe("suggestEmailCorrection", () => {
  it("catches the near-misses people actually type", () => {
    expect(suggestEmailCorrection("ada@gmial.com")).toBe("ada@gmail.com");
    expect(suggestEmailCorrection("ada@gmail.con")).toBe("ada@gmail.com");
    expect(suggestEmailCorrection("ada@hotmial.com")).toBe("ada@hotmail.com");
    expect(suggestEmailCorrection("ada@outlok.com")).toBe("ada@outlook.com");
  });

  it("says nothing about a domain that is already well known", () => {
    expect(suggestEmailCorrection("ada@gmail.com")).toBeNull();
    expect(suggestEmailCorrection("ada@proton.me")).toBeNull();
  });

  // Second-guessing a real company domain would be worse than the typo.
  it("says nothing about a domain that resembles nothing on the list", () => {
    expect(suggestEmailCorrection("ada@startuplab.io")).toBeNull();
    expect(suggestEmailCorrection("ada@acme-industries.co")).toBeNull();
    expect(suggestEmailCorrection("ada")).toBeNull();
  });

  it("keeps the local part exactly as the user typed it, folded", () => {
    expect(suggestEmailCorrection("ada.lovelace+news@gmial.com")).toBe("ada.lovelace+news@gmail.com");
  });
});
