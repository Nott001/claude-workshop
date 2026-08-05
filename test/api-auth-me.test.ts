import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const { requireAuth, getCurrentUserId, updateUser, findByUserId, update, create } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getCurrentUserId: vi.fn(),
  updateUser: vi.fn(),
  findByUserId: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth, getCurrentUserId }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/user.dao", () => ({ updateUser }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ findByUserId, update, create }));

import { PATCH } from "@/app/api/auth/me/route";

function patch(body: unknown) {
  return new Request("https://app.test/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const speaker = {
  id: 5,
  role: "speaker",
  full_name: "Ada",
  email: "ada@example.com",
  profile_image_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(speaker);
  getCurrentUserId.mockResolvedValue("auth_123");
  updateUser.mockResolvedValue({ ...speaker });
});

describe("PATCH /api/auth/me speaker profile guard", () => {
  it("forbids every non-speaker role from writing designation or bio", async () => {
    for (const role of ["attendee", "facilitator", "admin", "super_admin"]) {
      requireAuth.mockResolvedValue({ ...speaker, role });

      const res = await PATCH(patch({ designation: "CTO" }));

      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
      expect(updateUser).not.toHaveBeenCalled();
    }
  });

  it("lets a speaker update an existing speaker profile", async () => {
    findByUserId.mockResolvedValue({ id: 9, user_id: 5, designation: "Old", bio: null });
    update.mockResolvedValue({ id: 9, user_id: 5, designation: "CTO", bio: "Leads." });

    const res = await PATCH(patch({ designation: "CTO", bio: "Leads." }));

    expect(res.status).toBe(200);
    expect(updateUser).toHaveBeenCalledWith(expect.anything(), "auth_123", {
      designation: "CTO",
      bio: "Leads.",
    });
    expect(update).toHaveBeenCalledWith(expect.anything(), 9, { designation: "CTO", bio: "Leads." });
  });

  it("creates the speaker profile row when the speaker has none yet", async () => {
    findByUserId.mockResolvedValue(null);
    create.mockResolvedValue({ id: 12, user_id: 5, designation: "CTO", bio: null });

    const res = await PATCH(patch({ designation: "CTO", bio: null }));

    expect(res.status).toBe(200);
    expect(create).toHaveBeenCalledWith(expect.anything(), {
      user_id: 5,
      designation: "CTO",
      bio: null,
    });
  });
});
