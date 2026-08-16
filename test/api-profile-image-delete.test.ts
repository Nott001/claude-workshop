import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const {
  requireRole,
  guardFailure,
  getCurrentUserId,
  updateUser,
  findByUserId,
  update,
  uploadToStorage,
  listStorageFolder,
  deleteFromStorage,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  guardFailure: vi.fn(),
  getCurrentUserId: vi.fn(),
  updateUser: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  uploadToStorage: vi.fn(),
  listStorageFolder: vi.fn(),
  deleteFromStorage: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/modules/auth/lib/guard-response", () => ({ guardFailure }));
vi.mock("@/modules/auth/lib/session", () => ({ getCurrentUserId }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/user.dao", () => ({ updateUser }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ findByUserId, update }));
vi.mock("@/shared/integrations/storage/service", () => ({ uploadToStorage, listStorageFolder, deleteFromStorage }));

import { DELETE } from "@/app/api/upload/profile-image/route";

const user = {
  id: 5,
  role: ROLES.ATTENDEE,
  full_name: "Ada",
  email: "ada@example.com",
  profile_image_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ allowed: true, error: null, user });
  getCurrentUserId.mockResolvedValue("auth_123");
  updateUser.mockResolvedValue({ ...user });
  listStorageFolder.mockResolvedValue([]);
  deleteFromStorage.mockResolvedValue(undefined);
  findByUserId.mockResolvedValue(null);
  update.mockResolvedValue(null);
});

describe("DELETE /api/upload/profile-image", () => {
  it("refuses an unauthenticated caller before touching storage or the DAO", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });
    guardFailure.mockReturnValue(new Response(null, { status: 401 }));

    const res = await DELETE();

    expect(res.status).toBe(401);
    expect(listStorageFolder).not.toHaveBeenCalled();
    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses a forbidden caller the same way", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });
    guardFailure.mockReturnValue(new Response(null, { status: 403 }));

    const res = await DELETE();

    expect(res.status).toBe(403);
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("deletes the folder's files then clears the user row", async () => {
    listStorageFolder.mockResolvedValue(["users/5/a.jpg"]);
    updateUser.mockResolvedValue({ ...user, profile_image_url: "https://cdn.test/users/5/a.jpg" });

    const res = await DELETE();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(listStorageFolder).toHaveBeenCalledWith("profile_images", "users/5");
    expect(deleteFromStorage).toHaveBeenCalledWith("profile_images", ["users/5/a.jpg"]);
    expect(updateUser).toHaveBeenCalledWith(expect.anything(), "auth_123", { profile_image_url: null });
  });

  it("clears the row even when the folder is empty", async () => {
    listStorageFolder.mockResolvedValue([]);

    const res = await DELETE();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(deleteFromStorage).toHaveBeenCalledWith("profile_images", []);
    expect(updateUser).toHaveBeenCalledWith(expect.anything(), "auth_123", { profile_image_url: null });
  });

  it("reports a storage failure as a 500 without reaching the DAO", async () => {
    listStorageFolder.mockRejectedValue(new Error("bucket gone"));

    const res = await DELETE();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "bucket gone" });
    expect(deleteFromStorage).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("also clears the speaker photo_url fallback for speakers", async () => {
    requireRole.mockResolvedValue({ allowed: true, error: null, user: { ...user, role: ROLES.SPEAKER } });
    findByUserId.mockResolvedValue({ id: 9, user_id: 5, bio: null });
    update.mockResolvedValue({ id: 9, user_id: 5, bio: null });

    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(findByUserId).toHaveBeenCalledWith(expect.anything(), 5);
    expect(update).toHaveBeenCalledWith(expect.anything(), 9, { photo_url: null });
  });

  it("leaves the speaker profile alone for non-speakers", async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(findByUserId).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
});
