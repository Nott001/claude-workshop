import { describe, it, expect } from "vitest";
import {
  emailDomain,
  isSameEmail,
  normalizeEmail,
  RESEND_COOLDOWN_SECONDS,
  resendCooldownRemaining,
  suggestEmailCorrection,
} from "@/shared/lib/email";

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

describe("resendCooldownRemaining", () => {
  // Fixed so the assertions describe the arithmetic rather than how long the
  // test itself took to run.
  const now = Date.parse("2026-08-17T12:00:00.000Z");
  const sentAgo = (ms: number) => new Date(now - ms).toISOString();

  it("reports the seconds still owed on the window", () => {
    expect(resendCooldownRemaining(sentAgo(10_000), now)).toBe(50);
    expect(resendCooldownRemaining(sentAgo(45_000), now)).toBe(15);
  });

  it("rounds a part-second remainder up, never down to no wait at all", () => {
    // Reporting 0 here would re-offer a send the route still refuses.
    expect(resendCooldownRemaining(sentAgo(59_999), now)).toBe(1);
    expect(resendCooldownRemaining(sentAgo(30_500), now)).toBe(30);
  });

  it("frees the resend once the window has passed", () => {
    expect(resendCooldownRemaining(sentAgo(60_000), now)).toBe(0);
    expect(resendCooldownRemaining(sentAgo(3_600_000), now)).toBe(0);
  });

  // GoTrue leaves the field unset often enough that reading an unknown time as
  // "just sent" locked the address for good — only a cancel clears the pending
  // record the cooldown keys on, so the window never widened.
  it("asks for no wait when there is no usable send time", () => {
    for (const sentAt of [undefined, null, "", "not-a-date"]) {
      expect(resendCooldownRemaining(sentAt, now)).toBe(0);
    }
  });

  // The browser measures a server timestamp against its own clock.
  it("never asks for longer than the window when the clock is skewed ahead", () => {
    expect(resendCooldownRemaining(sentAgo(-600_000), now)).toBe(RESEND_COOLDOWN_SECONDS);
  });
});
