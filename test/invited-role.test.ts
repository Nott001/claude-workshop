import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect } from "vitest";
import { INVITABLE_ROLES, INVITED_ROLE_KEY, readInvitedRole } from "@/modules/auth/lib/invited-role";

describe("readInvitedRole", () => {
  it.each(INVITABLE_ROLES)("accepts the invitable role %s", (role) => {
    expect(readInvitedRole({ [INVITED_ROLE_KEY]: role })).toBe(role);
  });

  it("refuses super_admin, which no invite may grant", () => {
    // The only route to super_admin is a direct database change. An invite that
    // could mint one would make the whole role hierarchy meaningless.
    expect(readInvitedRole({ [INVITED_ROLE_KEY]: ROLES.SUPER_ADMIN })).toBeNull();
  });

  it("refuses attendee so the caller's own default is used", () => {
    expect(readInvitedRole({ [INVITED_ROLE_KEY]: ROLES.ATTENDEE })).toBeNull();
  });

  it.each([undefined, null, ROLES.ADMIN, 42, [], {}, { role: ROLES.ADMIN }, { [INVITED_ROLE_KEY]: null }])(
    "returns null for %j",
    (metadata) => {
      expect(readInvitedRole(metadata)).toBeNull();
    },
  );

  it("ignores an unrelated key that merely looks like a role", () => {
    expect(readInvitedRole({ user_role: ROLES.ADMIN, provider: "email" })).toBeNull();
  });

  it("refuses an arbitrary string", () => {
    expect(readInvitedRole({ [INVITED_ROLE_KEY]: "root" })).toBeNull();
  });
});
