import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUser, cookieGet, findByAuthId, ensureUser } = vi.hoisted(() => ({
  getUser: vi.fn(),
  cookieGet: vi.fn(),
  findByAuthId: vi.fn(),
  ensureUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser } }) }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: cookieGet, set: vi.fn(), delete: vi.fn() }),
}));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({ tag: "service" }) }));
vi.mock("@/shared/db/dao/user.dao", () => ({ findByAuthId }));

vi.mock("@/modules/auth/lib/ensure-user", () => ({ ensureUser }));

import { getCurrentUserId, getCurrentUser } from "@/modules/auth/lib/session";

const dbUser = {
  id: 5,
  auth_user_id: "auth_123",
  role: ROLES.ATTENDEE,
  full_name: "Jane Doe",
  email: "jane@example.com",
};

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "auth_123" } } });
  findByAuthId.mockResolvedValue(dbUser);
});

describe("getCurrentUserId", () => {
  it("returns the supabase auth id when a session exists", async () => {
    await expect(getCurrentUserId()).resolves.toBe("auth_123");
  });

  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(getCurrentUserId()).resolves.toBeNull();
  });
});

describe("getCurrentUser", () => {
  it("returns null without a session and never queries the database", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(findByAuthId).not.toHaveBeenCalled();
  });

  it("resolves the auth id to the application user record", async () => {
    await expect(getCurrentUser()).resolves.toEqual({
      id: 5,
      role: ROLES.ATTENDEE,
      full_name: "Jane Doe",
      email: "jane@example.com",
    });
  });

  it("does not expose auth_user_id to callers", async () => {
    const user = await getCurrentUser();
    expect(user).not.toHaveProperty("auth_user_id");
  });

  it("provisions a record on first sign-in when none exists yet", async () => {
    findByAuthId.mockResolvedValue(null);
    ensureUser.mockResolvedValue(dbUser);

    await expect(getCurrentUser()).resolves.toMatchObject({ id: 5 });
    expect(ensureUser).toHaveBeenCalledWith({ tag: "service" }, "auth_123");
  });

  it("returns null when provisioning fails rather than a partial user", async () => {
    findByAuthId.mockResolvedValue(null);
    ensureUser.mockResolvedValue(null);

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it("uses a caller-supplied client instead of opening another one", async () => {
    const caller = { tag: "caller" } as never;

    await getCurrentUser(caller);

    expect(findByAuthId).toHaveBeenCalledWith(caller, "auth_123");
  });
});
