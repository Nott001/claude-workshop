import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import { cleanupStaleAccounts, generateInviteLink, inviteUser, sendInviteEmail } from "@/modules/auth/lib/organization-service";
import { INVITED_ROLE_KEY } from "@/modules/auth/lib/invited-role";

const { findStaffByEmail, findAuthAccountByEmail, logAuditEvent, generateLink, updateUserById, deleteUser, send } = vi.hoisted(
  () => ({
    findStaffByEmail: vi.fn(),
    findAuthAccountByEmail: vi.fn(),
    logAuditEvent: vi.fn(),
    generateLink: vi.fn(),
    updateUserById: vi.fn(),
    deleteUser: vi.fn(),
    send: vi.fn(),
  }),
);

vi.mock("@/shared/db/dao/user.dao", () => ({ findStaffByEmail }));
vi.mock("@/modules/auth/lib/auth-account", () => ({ findAuthAccountByEmail }));
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
      "organization.invited",
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
      "organization.invited",
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
