import { describe, it, expect } from "vitest";
import { ROLES } from "@/shared/lib/roles";
import type { UserRole } from "@/shared/types";
import { qaAuthorKind } from "@/modules/courses/qa/lib/author-kind";

describe("qaAuthorKind", () => {
  it("labels a speaker response", () => {
    expect(qaAuthorKind(ROLES.SPEAKER)).toBe("speaker");
  });

  it("labels every staff role a staff response", () => {
    expect(qaAuthorKind(ROLES.FACILITATOR)).toBe("staff");
    expect(qaAuthorKind(ROLES.ADMIN)).toBe("staff");
    expect(qaAuthorKind(ROLES.SUPER_ADMIN)).toBe("staff");
  });

  it("leaves an attendee question unmatched", () => {
    expect(qaAuthorKind(ROLES.ATTENDEE)).toBe("attendee");
  });

  it("returns null when no role is present", () => {
    expect(qaAuthorKind(null)).toBeNull();
    expect(qaAuthorKind(undefined)).toBeNull();
  });

  it("classifies every role in the union exactly once", () => {
    const roles: UserRole[] = [ROLES.ATTENDEE, ROLES.SPEAKER, ROLES.FACILITATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN];
    expect(roles.map(qaAuthorKind)).toEqual(["attendee", "speaker", "staff", "staff", "staff"]);
  });
});
