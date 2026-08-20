import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const { requireRole, findRoleById, findById, updateRole, deleteAccount, logAuditEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findRoleById: vi.fn(),
  findById: vi.fn(),
  updateRole: vi.fn(),
  deleteAccount: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/user.dao", () => ({ findRoleById, updateRole, findById }));
vi.mock("@/modules/user/lib/delete-account", () => ({ deleteAccount }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));

import { PATCH, DELETE } from "@/app/api/users/[userId]/route";

const admin = { allowed: true, error: null, user: { id: 3, role: ROLES.ADMIN } };
const superAdmin = { allowed: true, error: null, user: { id: 1, role: ROLES.SUPER_ADMIN } };

const params = (userId: string) => ({ params: Promise.resolve({ userId }) });

function patch(userId: string, body: unknown) {
  return new Request(`https://app.test/api/users/${userId}`, { method: "PATCH", body: JSON.stringify(body) });
}

function del(userId: string) {
  return new Request(`https://app.test/api/users/${userId}`, { method: "DELETE" });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(admin);
  findRoleById.mockResolvedValue({ id: 9, full_name: "Ada", email: "ada@example.test", role: ROLES.ATTENDEE });
  updateRole.mockImplementation(async (_client: unknown, id: number, role: string) => ({
    id,
    full_name: "Ada",
    email: "ada@example.test",
    role,
  }));
  findById.mockResolvedValue({
    id: 9,
    full_name: "Ada",
    email: "ada@example.test",
    auth_user_id: "auth-9",
    role: ROLES.ATTENDEE,
  });
  deleteAccount.mockResolvedValue(undefined);
  logAuditEvent.mockResolvedValue(undefined);
});

describe("PATCH /api/users/[userId]", () => {
  it("promotes an attendee to facilitator", async () => {
    const res = await PATCH(patch("9", { role: ROLES.FACILITATOR }), params("9"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: 9, role: ROLES.FACILITATOR });
    expect(updateRole).toHaveBeenCalledWith(expect.anything(), 9, ROLES.FACILITATOR);
  });

  it("demotes a facilitator back to attendee", async () => {
    findRoleById.mockResolvedValue({ id: 9, role: ROLES.FACILITATOR });

    const res = await PATCH(patch("9", { role: ROLES.ATTENDEE }), params("9"));

    expect(res.status).toBe(200);
    expect(updateRole).toHaveBeenCalledWith(expect.anything(), 9, ROLES.ATTENDEE);
  });

  // The role being replaced is not in the request, so the audit row is the only
  // place it survives.
  it("records both roles in the audit trail", async () => {
    await PATCH(patch("9", { role: ROLES.SPEAKER }), params("9"));

    expect(logAuditEvent).toHaveBeenCalledWith(expect.anything(), 3, "user.role_changed", "user", 9, {
      previous_role: ROLES.ATTENDEE,
      new_role: ROLES.SPEAKER,
    });
  });

  it("refuses to change a super admin's role", async () => {
    requireRole.mockResolvedValue(superAdmin);
    findRoleById.mockResolvedValue({ id: 9, role: ROLES.SUPER_ADMIN });

    const res = await PATCH(patch("9", { role: ROLES.ADMIN }), params("9"));

    expect(res.status).toBe(403);
    expect(updateRole).not.toHaveBeenCalled();
  });

  it("refuses to assign super admin at all", async () => {
    requireRole.mockResolvedValue(superAdmin);

    const res = await PATCH(patch("9", { role: ROLES.SUPER_ADMIN }), params("9"));

    expect(res.status).toBe(400);
    expect(updateRole).not.toHaveBeenCalled();
  });

  it("lets only a super admin grant admin", async () => {
    const refused = await PATCH(patch("9", { role: ROLES.ADMIN }), params("9"));
    expect(refused.status).toBe(403);
    expect(updateRole).not.toHaveBeenCalled();

    requireRole.mockResolvedValue(superAdmin);
    const allowed = await PATCH(patch("9", { role: ROLES.ADMIN }), params("9"));
    expect(allowed.status).toBe(200);
  });

  it("refuses to change the caller's own role", async () => {
    const res = await PATCH(patch("3", { role: ROLES.ATTENDEE }), params("3"));

    expect(res.status).toBe(400);
    expect(updateRole).not.toHaveBeenCalled();
  });

  it("answers a missing user with 404 rather than writing", async () => {
    findRoleById.mockResolvedValue(null);

    const res = await PATCH(patch("99", { role: ROLES.SPEAKER }), params("99"));

    expect(res.status).toBe(404);
    expect(updateRole).not.toHaveBeenCalled();
  });

  // Number("abc") is NaN, which PostgREST answers with an error rather than an
  // empty result, so it is refused before it reaches the database.
  it("refuses a userId that is not a number", async () => {
    const res = await PATCH(patch("abc", { role: ROLES.SPEAKER }), params("abc"));

    expect(res.status).toBe(400);
    expect(findRoleById).not.toHaveBeenCalled();
  });

  it("refuses callers below admin", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await PATCH(patch("9", { role: ROLES.SPEAKER }), params("9"));

    expect(res.status).not.toBe(200);
    expect(updateRole).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/users/[userId]", () => {
  it("runs the full teardown for an ordinary member", async () => {
    const res = await DELETE(del("9"), params("9"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteAccount).toHaveBeenCalledWith({
      userId: 9,
      authUserId: "auth-9",
      email: "ada@example.test",
      role: ROLES.ATTENDEE,
    });
  });

  it("refuses to remove a super admin", async () => {
    findRoleById.mockResolvedValue({ id: 9, role: ROLES.SUPER_ADMIN });

    const res = await DELETE(del("9"), params("9"));

    expect(res.status).toBe(403);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("refuses to remove the caller", async () => {
    const res = await DELETE(del("3"), params("3"));

    expect(res.status).toBe(400);
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("refuses an admin deleting a peer", async () => {
    findRoleById.mockResolvedValue({ id: 9, role: ROLES.ADMIN });
    findById.mockResolvedValue({
      id: 9,
      full_name: "Ada",
      email: "ada@example.test",
      auth_user_id: "auth-9",
      role: ROLES.ADMIN,
    });

    const res = await DELETE(del("9"), params("9"));

    expect(res.status).toBe(403);
    expect(deleteAccount).not.toHaveBeenCalled();
  });
});
