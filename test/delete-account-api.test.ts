import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const { requireAuth, getCurrentUserId, deleteAccount } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getCurrentUserId: vi.fn(),
  deleteAccount: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth, getCurrentUserId }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/user/lib/delete-account", () => ({ deleteAccount }));

import { DELETE } from "@/app/api/auth/me/route";

const user = {
  id: 7,
  role: ROLES.ATTENDEE,
  full_name: "Ada",
  email: "ada@example.com",
  profile_image_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(user);
  getCurrentUserId.mockResolvedValue("auth_7");
  deleteAccount.mockResolvedValue(undefined);
});

describe("DELETE /api/auth/me", () => {
  it("returns 401 without a session and never calls the service", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await DELETE();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("returns 401 when the auth UUID cannot be resolved", async () => {
    getCurrentUserId.mockResolvedValue(null);

    const res = await DELETE();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
    expect(deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes the caller's account and reports ok", async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteAccount).toHaveBeenCalledWith({
      userId: 7,
      authUserId: "auth_7",
      email: "ada@example.com",
      role: ROLES.ATTENDEE,
    });
  });

  it("maps a service failure to a generic 500", async () => {
    deleteAccount.mockRejectedValue(new Error("Failed to delete the user's ticket rows"));

    const res = await DELETE();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Could not delete your account. Please try again.",
    });
  });
});
