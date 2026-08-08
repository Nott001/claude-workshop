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

import { getCurrentUserId, requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";

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

describe("requireAuth", () => {
  it("returns null without a session and never queries the database", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(requireAuth()).resolves.toBeNull();
    expect(findByAuthId).not.toHaveBeenCalled();
  });

  it("resolves the auth id to the application user record", async () => {
    await expect(requireAuth()).resolves.toEqual({
      id: 5,
      role: ROLES.ATTENDEE,
      full_name: "Jane Doe",
      email: "jane@example.com",
    });
  });

  it("does not expose auth_user_id to callers", async () => {
    const user = await requireAuth();
    expect(user).not.toHaveProperty("auth_user_id");
  });

  it("provisions a record on first sign-in when none exists yet", async () => {
    findByAuthId.mockResolvedValue(null);
    ensureUser.mockResolvedValue(dbUser);

    await expect(requireAuth()).resolves.toMatchObject({ id: 5 });
    expect(ensureUser).toHaveBeenCalledWith({ tag: "service" }, "auth_123");
  });

  it("returns null when provisioning fails rather than a partial user", async () => {
    findByAuthId.mockResolvedValue(null);
    ensureUser.mockResolvedValue(null);

    await expect(requireAuth()).resolves.toBeNull();
  });

  it("uses a caller-supplied client instead of opening another one", async () => {
    const caller = { tag: "caller" } as never;

    await requireAuth(caller);

    expect(findByAuthId).toHaveBeenCalledWith(caller, "auth_123");
  });
});

describe("requireRole", () => {
  it("denies an unauthenticated caller", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(requireRole(ROLES.FACILITATOR)).resolves.toEqual({
      allowed: false,
      error: "Unauthenticated",
      user: null,
    });
  });

  it("denies a caller holding a different role", async () => {
    const result = await requireRole(ROLES.FACILITATOR);

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Forbidden");
    // The rejected user must not be handed back to the caller.
    expect(result.user).toBeNull();
  });

  it("admits a caller holding the required role", async () => {
    findByAuthId.mockResolvedValue({ ...dbUser, role: ROLES.FACILITATOR });

    const result = await requireRole(ROLES.FACILITATOR);

    expect(result.allowed).toBe(true);
    expect(result.user).toMatchObject({ id: 5, role: ROLES.FACILITATOR });
  });

  it("admits a caller holding any one of several accepted roles", async () => {
    findByAuthId.mockResolvedValue({ ...dbUser, role: ROLES.SPEAKER });

    await expect(requireRole(ROLES.FACILITATOR, ROLES.SPEAKER)).resolves.toMatchObject({ allowed: true });
  });

  it("admits any authenticated caller when no role is named", async () => {
    await expect(requireRole()).resolves.toMatchObject({ allowed: true });
  });
});
