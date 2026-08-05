import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const { requireRole, findStaffByEmail, listStaff, logAuditEvent, inviteUserByEmail, updateUserById } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findStaffByEmail: vi.fn(),
  listStaff: vi.fn(),
  logAuditEvent: vi.fn(),
  inviteUserByEmail: vi.fn(),
  updateUserById: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ auth: { admin: { inviteUserByEmail, updateUserById } } }),
}));
vi.mock("@/shared/db/dao", () => ({ userDao: { findStaffByEmail, listStaff } }));
vi.mock("@/modules/audit", () => ({ logAuditEvent }));

import { POST } from "@/app/api/organization/route";
import { INVITED_ROLE_KEY } from "@/modules/auth/lib/invited-role";

const admin = { allowed: true, error: null, user: { id: 3, role: "admin" } };
const superAdmin = { allowed: true, error: null, user: { id: 1, role: "super_admin" } };

function post(body: unknown) {
  return new Request("https://app.test/api/organization", { method: "POST", body: JSON.stringify(body) });
}

const INVITE = { full_name: "Jane Doe", email: "jane@example.com", role: "speaker" };

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(admin);
  findStaffByEmail.mockResolvedValue(null);
  inviteUserByEmail.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
  updateUserById.mockResolvedValue({ error: null });
  logAuditEvent.mockResolvedValue(undefined);
});

describe("POST /api/organization", () => {
  it("sends the invitation through Supabase", async () => {
    const res = await POST(post(INVITE));

    expect(res.status).toBe(201);
    expect(inviteUserByEmail).toHaveBeenCalledWith(
      "jane@example.com",
      expect.objectContaining({ data: { full_name: "Jane Doe", role: "speaker" } }),
    );
  });

  it("carries the role into user_metadata for the template without granting it there", async () => {
    await POST(post(INVITE));

    // The template renders .Data.role; ensure-user ignores it and reads
    // app_metadata, so a user rewriting their own metadata gains nothing.
    expect(inviteUserByEmail.mock.calls[0][1].data.role).toBe("speaker");
    expect(updateUserById).toHaveBeenCalledWith("auth-1", { app_metadata: { [INVITED_ROLE_KEY]: "speaker" } });
  });

  it("points the invite link at the auth callback without doubling the slash", async () => {
    await POST(post(INVITE));

    const { redirectTo } = inviteUserByEmail.mock.calls[0][1];
    expect(redirectTo).toMatch(/^https?:\/\/[^/]+(\/[^/]+)*\/api\/auth\/callback$/);
  });

  it("records the granted role where only the service role can write it", async () => {
    await POST(post(INVITE));

    // app_metadata, never user_metadata: a user can rewrite the latter through
    // supabase.auth.updateUser and would be able to promote themselves.
    expect(updateUserById).toHaveBeenCalledWith("auth-1", { app_metadata: { [INVITED_ROLE_KEY]: "speaker" } });
  });

  it("writes the audit row only once the invite has actually gone out", async () => {
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "smtp unavailable" } });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(502);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("reports a duplicate as a conflict rather than a send failure", async () => {
    inviteUserByEmail.mockResolvedValue({ data: null, error: { message: "User already registered" } });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(409);
  });

  it("does not claim success when the role could not be attached", async () => {
    updateUserById.mockResolvedValue({ error: { message: "metadata write failed" } });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: { message: expect.stringContaining("role") } });
  });

  it("rejects an existing user before sending anything", async () => {
    findStaffByEmail.mockResolvedValue({ id: 9 });

    const res = await POST(post(INVITE));

    expect(res.status).toBe(409);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("stops an admin from inviting another admin", async () => {
    const res = await POST(post({ ...INVITE, role: "admin" }));

    expect(res.status).toBe(403);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("lets a super admin invite an admin", async () => {
    requireRole.mockResolvedValue(superAdmin);

    const res = await POST(post({ ...INVITE, role: "admin" }));

    expect(res.status).toBe(201);
    expect(updateUserById).toHaveBeenCalledWith("auth-1", { app_metadata: { [INVITED_ROLE_KEY]: "admin" } });
  });

  it("refuses to invite a super admin", async () => {
    requireRole.mockResolvedValue(superAdmin);

    const res = await POST(post({ ...INVITE, role: "super_admin" }));

    expect(res.status).toBe(400);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("issues no invitation when the caller is not staff", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "forbidden", user: null });

    await POST(post(INVITE));

    expect(inviteUserByEmail).not.toHaveBeenCalled();
    expect(findStaffByEmail).not.toHaveBeenCalled();
  });
});
