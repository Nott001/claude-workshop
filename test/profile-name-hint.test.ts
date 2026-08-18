import { describe, it, expect } from "vitest";
import { profileNameHint } from "@/modules/user/lib/profile-name-hint";
import { ALL_ROLES, ROLES } from "@/shared/lib/roles";

describe("profileNameHint", () => {
  it("names the surfaces an attendee actually has", () => {
    const hint = profileNameHint(ROLES.ATTENDEE)!;

    expect(hint).toMatch(/tickets/);
    expect(hint).toMatch(/check-in/);
  });

  it("leads with the session pages for a speaker, which nobody else has", () => {
    expect(profileNameHint(ROLES.SPEAKER)).toMatch(/session pages/);
  });

  it("names the staff surfaces for a facilitator rather than an attendee's", () => {
    const hint = profileNameHint(ROLES.FACILITATOR)!;

    expect(hint).toMatch(/course room/);
    expect(hint).toMatch(/support chats/);
    expect(hint).not.toMatch(/ticket/);
  });

  it("names the same staff surfaces for both admin tiers", () => {
    expect(profileNameHint(ROLES.ADMIN)).toBe(profileNameHint(ROLES.SUPER_ADMIN));
    expect(profileNameHint(ROLES.ADMIN)).toMatch(/support chats/);
  });

  // The hedge this replaced — "and, if you speak, your session pages" — asked
  // every reader to work out whether a clause applied to them.
  it("never asks the reader to work out whether a clause applies to them", () => {
    for (const role of ALL_ROLES) {
      expect(profileNameHint(role), role).not.toMatch(/\bif you\b/i);
    }
  });

  it("gives every role its own answer, and gives one to all of them", () => {
    const hints = ALL_ROLES.map((role) => profileNameHint(role));

    expect(hints.every((h) => typeof h === "string" && h.length > 0)).toBe(true);
    // Only the two admin tiers legitimately share copy.
    expect(new Set(hints).size).toBe(ALL_ROLES.length - 1);
  });

  // The page renders before the session resolves. Naming the wrong surfaces
  // for a moment and then swapping them is worse than saying nothing.
  it("says nothing until the role is known", () => {
    expect(profileNameHint(undefined)).toBeUndefined();
  });
});
