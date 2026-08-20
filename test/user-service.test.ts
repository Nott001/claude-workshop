import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import type { Actor } from "@/modules/user/lib/user-service";
import {
  changeUserRole,
  cleanupStaleAccounts,
  generateInviteLink,
  inviteUser,
  deleteUserAccount,
  sendInviteEmail,
} from "@/modules/user/lib/user-service";
import { INVITED_ROLE_KEY } from "@/modules/auth/lib/invited-role";

const {
  findStaffByEmail,
  findRoleById,
  findById,
  updateRole,
  deleteAccount,
  findAuthAccountByEmail,
  logAuditEvent,
  generateLink,
  updateUserById,
  deleteUser,
  send,
} = vi.hoisted(() => ({
  findStaffByEmail: vi.fn(),
  findRoleById: vi.fn(),
  findById: vi.fn(),
  updateRole: vi.fn(),
  deleteAccount: vi.fn(),
  findAuthAccountByEmail: vi.fn(),
  logAuditEvent: vi.fn(),
  generateLink: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/shared/db/dao/user.dao", () => ({ findStaffByEmail, findRoleById, updateRole, findById }));
vi.mock("@/modules/auth/lib/auth-account", () => ({ findAuthAccountByEmail }));
vi.mock("@/modules/user/lib/delete-account", () => ({ deleteAccount }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));
vi.mock("@/shared/integrations/email", () => ({ getEmailService: () => ({ send }) }));

const supabase = { auth: { admin: { generateLink, updateUserById, deleteUser } } } as unknown as DbClient;
const TOKEN = "aaaabbbbccccddddeeeeffff";
const INVITE = { full_name: "Jane Doe", email: "jane@example.com", role: ROLES.SPEAKER };

beforeEach(() => {
  vi.clearAllMocks();
  findStaffByEmail.mockResolvedValue(null);
  findRoleById.mockResolvedValue({ id: 9, role: ROLES.ATTENDEE });
  updateRole.mockImplementation(async (_c: unknown, id: number, role: string) => ({
    id,
    full_name: "Ada",
    email: "a@b.c",
    role,
  }));
  findById.mockResolvedValue({ id: 9, full_name: "Ada", email: "a@b.c", auth_user_id: "auth-9", role: ROLES.ATTENDEE });
  deleteAccount.mockResolvedValue(undefined);
  findAuthAccountByEmail.mockResolvedValue(null);
  generateLink.mockResolvedValue({ data: { user: { id: "auth-1" }, properties: { hashed_token: TOKEN } }, error: null });
  updateUserById.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
  send.mockResolvedValue({ success: true });
  logAuditEvent.mockResolvedValue(undefined);
});

describe("cleanupStaleAccounts", () => {
  it("removes an account nobody ever signed in with", async () => {
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-stale", accepted: false });

    expect(await cleanupStaleAccounts(supabase, INVITE.email)).toBe(true);
    expect(deleteUser).toHaveBeenCalledWith("auth-stale");
  });

  it("leaves the address alone when there is no account", async () => {
    expect(await cleanupStaleAccounts(supabase, INVITE.email)).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses an address whose owner has signed in", async () => {
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-live", accepted: true });

    await expect(cleanupStaleAccounts(supabase, INVITE.email)).rejects.toMatchObject({ status: 409 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("says so when the earlier invitation could not be cleared", async () => {
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-stale", accepted: false });
    deleteUser.mockResolvedValue({ error: { message: "service unavailable" } });

    await expect(cleanupStaleAccounts(supabase, INVITE.email)).rejects.toMatchObject({ status: 502 });
  });
});

describe("generateInviteLink", () => {
  it("returns the token without sending anything", async () => {
    const link = await generateInviteLink(supabase, INVITE);

    expect(link).toEqual({ userId: "auth-1", hashedToken: TOKEN });
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "invite", email: INVITE.email }));
    expect(updateUserById).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({
        app_metadata: { [INVITED_ROLE_KEY]: ROLES.SPEAKER },
        user_metadata: { full_name: "Jane Doe" },
      }),
    );
    expect(send).not.toHaveBeenCalled();
  });

  it("reports a duplicate address as a conflict", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "User already registered" } });

    await expect(generateInviteLink(supabase, INVITE)).rejects.toMatchObject({ status: 409 });
  });

  it("removes the account when the role could not be attached", async () => {
    updateUserById.mockResolvedValue({ error: { message: "metadata write failed" } });

    await expect(generateInviteLink(supabase, INVITE)).rejects.toMatchObject({ status: 500 });
    expect(deleteUser).toHaveBeenCalledWith("auth-1");
  });
});

describe("sendInviteEmail", () => {
  it("addresses the message to the invitee and links to our own domain", async () => {
    await sendInviteEmail(supabase, { userId: "auth-1", hashedToken: TOKEN }, INVITE);

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: { email: INVITE.email, name: INVITE.full_name },
        htmlContent: expect.stringContaining(`/invite?token=${TOKEN}`),
      }),
    );
  });

  it("removes the half-created account and reports when the mail cannot be sent", async () => {
    send.mockResolvedValue({ success: false, error: "connection refused" });

    await expect(sendInviteEmail(supabase, { userId: "auth-1", hashedToken: TOKEN }, INVITE)).rejects.toMatchObject({
      status: 502,
    });
    expect(deleteUser).toHaveBeenCalledWith("auth-1");
  });
});

describe("inviteUser", () => {
  it("creates the account, mails the invitation and records it", async () => {
    const result = await inviteUser(supabase, INVITE, 3);

    expect(result).toEqual({ email: INVITE.email, role: ROLES.SPEAKER });
    expect(logAuditEvent).toHaveBeenCalledWith(
      supabase,
      3,
      "user.invited",
      "user",
      null,
      expect.objectContaining({ resent: false }),
    );
  });

  it("rejects an existing user before creating anything", async () => {
    findStaffByEmail.mockResolvedValue({ id: 9 });

    await expect(inviteUser(supabase, INVITE, 3)).rejects.toMatchObject({ status: 409 });
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("marks a replaced invitation as a resend", async () => {
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-stale", accepted: false });

    await inviteUser(supabase, INVITE, 3);

    expect(logAuditEvent).toHaveBeenCalledWith(
      supabase,
      3,
      "user.invited",
      "user",
      null,
      expect.objectContaining({ resent: true }),
    );
  });

  it("records nothing when the mail never went out", async () => {
    send.mockResolvedValue({ success: false, error: "SMTP session timed out" });

    await expect(inviteUser(supabase, INVITE, 3)).rejects.toMatchObject({ status: 502 });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

const admin: Actor = { id: 3, role: ROLES.ADMIN };
const superAdmin: Actor = { id: 1, role: ROLES.SUPER_ADMIN };

/**
 * Driven directly rather than through PATCH/DELETE: these are the rules that
 * decide who may act on whom, and pinning them to HTTP status codes states them
 * only as far as the route happens to translate them.
 */
describe("changeUserRole", () => {
  it("promotes an attendee to a role the actor outranks", async () => {
    const user = await changeUserRole(supabase, { targetId: 9, role: ROLES.FACILITATOR }, admin);

    expect(user).toMatchObject({ id: 9, role: ROLES.FACILITATOR });
    expect(updateRole).toHaveBeenCalledWith(supabase, 9, ROLES.FACILITATOR);
  });

  it("records the role it replaced, which the request never carried", async () => {
    findRoleById.mockResolvedValue({ id: 9, role: ROLES.SPEAKER });

    await changeUserRole(supabase, { targetId: 9, role: ROLES.FACILITATOR }, admin);

    expect(logAuditEvent).toHaveBeenCalledWith(supabase, 3, "user.role_changed", "user", 9, {
      previous_role: ROLES.SPEAKER,
      new_role: ROLES.FACILITATOR,
    });
  });

  // An admin minting admins is how one compromised account becomes several.
  it("refuses a role the actor only equals", async () => {
    await expect(changeUserRole(supabase, { targetId: 9, role: ROLES.ADMIN }, admin)).rejects.toMatchObject({ status: 403 });
    expect(updateRole).not.toHaveBeenCalled();

    await expect(changeUserRole(supabase, { targetId: 9, role: ROLES.ADMIN }, superAdmin)).resolves.toMatchObject({
      role: ROLES.ADMIN,
    });
  });

  it("refuses before reading the target, when the role alone settles it", async () => {
    await expect(changeUserRole(supabase, { targetId: 9, role: ROLES.ADMIN }, admin)).rejects.toMatchObject({ status: 403 });

    expect(findRoleById).not.toHaveBeenCalled();
  });
});

describe("acting on a user at all", () => {
  for (const [name, act] of [
    ["changeUserRole", (id: number, actor: Actor) => changeUserRole(supabase, { targetId: id, role: ROLES.SPEAKER }, actor)],
    ["deleteUserAccount", (id: number, actor: Actor) => deleteUserAccount(supabase, id, actor)],
  ] as const) {
    it(`${name} refuses a super admin, whoever asks`, async () => {
      findRoleById.mockResolvedValue({ id: 9, role: ROLES.SUPER_ADMIN });

      await expect(act(9, superAdmin)).rejects.toMatchObject({ status: 403 });
      expect(updateRole).not.toHaveBeenCalled();
      expect(deleteAccount).not.toHaveBeenCalled();
    });

    it(`${name} refuses the actor's own account`, async () => {
      await expect(act(admin.id, admin)).rejects.toMatchObject({ status: 400 });
      expect(findRoleById).not.toHaveBeenCalled();
    });

    it(`${name} answers a missing member with 404 rather than writing`, async () => {
      findRoleById.mockResolvedValue(null);

      await expect(act(9, admin)).rejects.toMatchObject({ status: 404 });
      expect(updateRole).not.toHaveBeenCalled();
      expect(deleteAccount).not.toHaveBeenCalled();
    });
  }
});

describe("deleteUserAccount", () => {
  it("runs the full teardown for a target the actor outranks", async () => {
    await deleteUserAccount(supabase, 9, admin);

    expect(deleteAccount).toHaveBeenCalledWith({
      userId: 9,
      authUserId: "auth-9",
      email: "a@b.c",
      role: ROLES.ATTENDEE,
    });
    expect(logAuditEvent).toHaveBeenCalledWith(supabase, 3, "user.deleted", "user", 9, { role: ROLES.ATTENDEE });
  });

  it("refuses a user the actor only equals", async () => {
    findRoleById.mockResolvedValue({ id: 9, role: ROLES.ADMIN });
    findById.mockResolvedValue({ id: 9, full_name: "Ada", email: "a@b.c", auth_user_id: "auth-9", role: ROLES.ADMIN });

    await expect(deleteUserAccount(supabase, 9, admin)).rejects.toMatchObject({ status: 403 });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("lets a super admin delete an admin", async () => {
    findRoleById.mockResolvedValue({ id: 9, role: ROLES.ADMIN });
    findById.mockResolvedValue({ id: 9, full_name: "Ada", email: "a@b.c", auth_user_id: "auth-9", role: ROLES.ADMIN });

    await expect(deleteUserAccount(supabase, 9, superAdmin)).resolves.toBeUndefined();
    expect(deleteAccount).toHaveBeenCalledWith({
      userId: 9,
      authUserId: "auth-9",
      email: "a@b.c",
      role: ROLES.ADMIN,
    });
  });

  it("reports a failed purge as a 500 carrying its message", async () => {
    deleteAccount.mockRejectedValue(new Error("Failed to delete chat messages sent by the user"));

    await expect(deleteUserAccount(supabase, 9, admin)).rejects.toMatchObject({
      status: 500,
      message: "Failed to delete chat messages sent by the user",
    });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
