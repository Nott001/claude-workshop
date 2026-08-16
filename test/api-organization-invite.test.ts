import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const {
  requireRole,
  findStaffByEmail,
  findAuthAccountByEmail,
  listStaff,
  logAuditEvent,
  generateLink,
  updateUserById,
  deleteUser,
  send,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findStaffByEmail: vi.fn(),
  findAuthAccountByEmail: vi.fn(),
  listStaff: vi.fn(),
  logAuditEvent: vi.fn(),
  generateLink: vi.fn(),
  updateUserById: vi.fn(),
  deleteUser: vi.fn(),
  send: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/modules/auth/lib/auth-account", () => ({ findAuthAccountByEmail }));
vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ auth: { admin: { generateLink, updateUserById, deleteUser } } }),
}));
vi.mock("@/shared/db/dao/user.dao", () => ({ findStaffByEmail, listStaff }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));
vi.mock("@/shared/integrations/email", () => ({ getEmailService: () => ({ send }) }));

import { POST, GET } from "@/app/api/organization/route";
import { INVITED_ROLE_KEY } from "@/modules/auth/lib/invited-role";

const admin = { allowed: true, error: null, user: { id: 3, role: ROLES.ADMIN } };
const superAdmin = { allowed: true, error: null, user: { id: 1, role: ROLES.SUPER_ADMIN } };

function post(body: unknown) {
  return new Request("https://app.test/api/organization", { method: "POST", body: JSON.stringify(body) });
}

const INVITE = { full_name: "Jane Doe", email: "jane@example.com", role: ROLES.SPEAKER };
// Low-entropy on purpose; see test/invite-accept.test.ts.
const TOKEN = "aaaabbbbccccddddeeeeffff";

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(admin);
  findStaffByEmail.mockResolvedValue(null);
  findAuthAccountByEmail.mockResolvedValue(null);
  generateLink.mockResolvedValue({ data: { user: { id: "auth-1" }, properties: { hashed_token: TOKEN } }, error: null });
  updateUserById.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ error: null });
  send.mockResolvedValue({ success: true });
  logAuditEvent.mockResolvedValue(undefined);
});

describe("GET /api/organization", () => {
  const staff = [
    { id: 1, full_name: "Ada Lovelace", email: "ada@example.com", role: ROLES.SPEAKER },
    { id: 2, full_name: "Grace Hopper", email: "grace@example.com", role: ROLES.ADMIN },
  ];

  it("lists a page of staff with no filters", async () => {
    listStaff.mockResolvedValue({ data: staff, total: 2, page: 1, limit: 10 });

    const res = await GET(new Request("https://app.test/api/organization"));

    expect(res.status).toBe(200);
    expect(listStaff).toHaveBeenCalledWith(expect.anything(), { page: 1, search: "", pageSize: 10, role: undefined });
    await expect(res.json()).resolves.toMatchObject({ users: staff, total: 2, page: 1 });
  });

  it("forwards a validated role filter", async () => {
    listStaff.mockResolvedValue({ data: [staff[1]], total: 1, page: 1, limit: 10 });

    await GET(new Request("https://app.test/api/organization?role=admin"));

    expect(listStaff).toHaveBeenCalledWith(expect.anything(), { page: 1, search: "", pageSize: 10, role: ROLES.ADMIN });
  });

  it("rejects a role that is not in the staff set", async () => {
    const res = await GET(new Request("https://app.test/api/organization?role=attendee"));

    expect(res.status).toBe(400);
    expect(listStaff).not.toHaveBeenCalled();
  });

  it("forwards a search term alongside a role", async () => {
    listStaff.mockResolvedValue({ data: [staff[0]], total: 1, page: 1, limit: 10 });

    await GET(new Request("https://app.test/api/organization?search=ada&role=speaker"));

    expect(listStaff).toHaveBeenCalledWith(expect.anything(), { page: 1, search: "ada", pageSize: 10, role: ROLES.SPEAKER });
  });
});

describe("POST /api/organization", () => {
  it("sends the invitation itself rather than letting Supabase mail it", async () => {
    const res = await POST(post(INVITE));

    expect(res.status).toBe(201);
    // generateLink creates the account without sending anything.
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ type: "invite", email: "jane@example.com" }));
    expect(send).toHaveBeenCalledOnce();
  });

  it("addresses the message to the invitee and names their role", async () => {
    await POST(post(INVITE));
    const sent = send.mock.calls[0][0];

    expect(sent.to).toEqual({ email: "jane@example.com", name: "Jane Doe" });
    expect(sent.htmlContent).toContain(ROLES.SPEAKER);
    expect(sent.textContent).toContain(ROLES.SPEAKER);
  });

  it("carries a written plain-text alternative, not just HTML", async () => {
    await POST(post(INVITE));
    const sent = send.mock.calls[0][0];

    expect(sent.textContent).toContain("Startup Lab");
    expect(sent.textContent).not.toContain("<");
  });

  it("links to our own domain rather than straight to Supabase", async () => {
    // A message from startuplab.center whose only link points at supabase.co is
    // the shape of a phishing attempt, and filters weight it accordingly.
    await POST(post(INVITE));
    const sent = send.mock.calls[0][0];

    expect(sent.htmlContent).toContain(`/invite?token=${TOKEN}`);
    expect(sent.htmlContent).not.toContain("supabase.co");
    expect(sent.textContent).not.toContain("supabase.co");
  });

  it("records the granted role where only the service role can write it", async () => {
    await POST(post(INVITE));

    // app_metadata, never user_metadata: a user can rewrite the latter through
    // supabase.auth.updateUser and would be able to promote themselves.
    expect(updateUserById).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({ app_metadata: { [INVITED_ROLE_KEY]: ROLES.SPEAKER } }),
    );
  });

  it("keeps the name the admin typed so the account is not created blank", async () => {
    // ensure-user reads full_name from user_metadata on first sign-in; without
    // this the invited member arrives with no name at all.
    await POST(post(INVITE));

    expect(updateUserById).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({ user_metadata: { full_name: "Jane Doe" } }),
    );
  });

  it("writes the audit row only once the mail has actually gone out", async () => {
    send.mockResolvedValue({ success: false, error: "SMTP session timed out" });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(502);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("removes the half-created account when the mail cannot be sent", async () => {
    // Otherwise a retry hits "already registered" for an account whose owner
    // has never heard of it.
    send.mockResolvedValue({ success: false, error: "connection refused" });

    await POST(post(INVITE));

    expect(deleteUser).toHaveBeenCalledWith("auth-1");
  });

  it("removes the account when the role could not be attached", async () => {
    updateUserById.mockResolvedValue({ error: { message: "metadata write failed" } });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(500);
    expect(deleteUser).toHaveBeenCalledWith("auth-1");
    expect(send).not.toHaveBeenCalled();
  });

  it("reports a duplicate as a conflict rather than a send failure", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "User already registered" } });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(409);
    expect(send).not.toHaveBeenCalled();
  });

  it("invites again when the first invitation was never accepted", async () => {
    // The account Supabase created for the earlier invitation is still there and
    // blocks a second one, even though nobody has ever signed in with it.
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-stale", accepted: false });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(201);
    expect(deleteUser).toHaveBeenCalledWith("auth-stale");
    expect(generateLink).toHaveBeenCalledWith(expect.objectContaining({ email: "jane@example.com" }));
    expect(send).toHaveBeenCalledOnce();
  });

  it("hands the resent invitation whichever role was chosen this time", async () => {
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-stale", accepted: false });

    await POST(post({ ...INVITE, role: ROLES.FACILITATOR }));

    expect(updateUserById).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({ app_metadata: { [INVITED_ROLE_KEY]: ROLES.FACILITATOR } }),
    );
  });

  it("marks a replaced invitation as a resend in the audit log", async () => {
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-stale", accepted: false });

    await POST(post(INVITE));

    expect(logAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      3,
      "organization.invited",
      "user",
      null,
      expect.objectContaining({ resent: true }),
    );
  });

  it("says so when the earlier invitation could not be cleared", async () => {
    // Reporting the "already registered" that would follow would blame the
    // address rather than the delete that actually failed.
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-stale", accepted: false });
    deleteUser.mockResolvedValue({ error: { message: "service unavailable" } });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(502);
    expect(generateLink).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses once the invitation has actually been accepted", async () => {
    // Signed in at least once, so the account belongs to a person rather than to
    // an invitation left unopened.
    findAuthAccountByEmail.mockResolvedValue({ id: "auth-live", accepted: true });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(409);
    expect(deleteUser).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("rejects an existing user before creating anything", async () => {
    findStaffByEmail.mockResolvedValue({ id: 9 });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(409);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("stops an admin from inviting another admin", async () => {
    const res = await POST(post({ ...INVITE, role: ROLES.ADMIN }));

    expect(res.status).toBe(403);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("lets a super admin invite an admin", async () => {
    requireRole.mockResolvedValue(superAdmin);

    const res = await POST(post({ ...INVITE, role: ROLES.ADMIN }));

    expect(res.status).toBe(201);
    expect(updateUserById).toHaveBeenCalledWith(
      "auth-1",
      expect.objectContaining({ app_metadata: { [INVITED_ROLE_KEY]: ROLES.ADMIN } }),
    );
  });

  it("refuses to invite a super admin", async () => {
    requireRole.mockResolvedValue(superAdmin);

    const res = await POST(post({ ...INVITE, role: ROLES.SUPER_ADMIN }));

    expect(res.status).toBe(400);
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("issues no invitation when the caller is not staff", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "forbidden", user: null });

    await POST(post(INVITE));

    expect(generateLink).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });
});
