import { describe, it, expect } from "vitest";
import { isSameEmail, normalizeEmail } from "@/shared/lib/email";

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
