import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { AuthUser } from "@/modules/auth/lib/types";

vi.mock("@/modules/auth/lib/session", () => ({
  requireAuth: vi.fn(),
}));

import { requireAuth } from "@/modules/auth/lib/session";
import { requireMinRole, requireRole } from "@/modules/auth/lib/role-guard";

const user = (role: AuthUser["role"]): AuthUser => ({
  id: 1,
  role,
  full_name: "Test",
  email: "test@test.com",
  profile_image_url: null,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireMinRole — 'at least this level'", () => {
  it("denies an unauthenticated caller", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null);

    await expect(requireMinRole(ROLES.FACILITATOR)).resolves.toEqual({
      allowed: false,
      error: "Unauthenticated",
      user: null,
    });
  });

  it.each([ROLES.ATTENDEE, ROLES.SPEAKER])("%s is denied a facilitator floor", async (role) => {
    vi.mocked(requireAuth).mockResolvedValue(user(role));

    const result = await requireMinRole(ROLES.FACILITATOR);

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Forbidden");
    expect(result.user).toBeNull();
  });

  it.each([ROLES.FACILITATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN])("%s clears a facilitator floor", async (role) => {
    vi.mocked(requireAuth).mockResolvedValue(user(role));

    await expect(requireMinRole(ROLES.FACILITATOR)).resolves.toMatchObject({ allowed: true, user: { role } });
  });

  it("admits an attendee against the attendee floor", async () => {
    vi.mocked(requireAuth).mockResolvedValue(user(ROLES.ATTENDEE));

    await expect(requireMinRole(ROLES.ATTENDEE)).resolves.toMatchObject({ allowed: true });
  });
});

describe("requireRole — exactly one of the listed roles", () => {
  it("denies an unauthenticated caller", async () => {
    vi.mocked(requireAuth).mockResolvedValue(null);

    await expect(requireRole(ROLES.ATTENDEE)).resolves.toEqual({
      allowed: false,
      error: "Unauthenticated",
      user: null,
    });
  });

  it("admits a caller holding one of the listed roles", async () => {
    vi.mocked(requireAuth).mockResolvedValue(user(ROLES.SPEAKER));

    await expect(requireRole(ROLES.ATTENDEE, ROLES.SPEAKER)).resolves.toMatchObject({ allowed: true });
  });

  it("rejects a higher role that is not on the list", async () => {
    vi.mocked(requireAuth).mockResolvedValue(user(ROLES.ADMIN));

    const result = await requireRole(ROLES.FACILITATOR, ROLES.SPEAKER);

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Forbidden");
  });

  it("rejects a caller holding no listed role", async () => {
    vi.mocked(requireAuth).mockResolvedValue(user(ROLES.ATTENDEE));

    const result = await requireRole(ROLES.FACILITATOR);

    expect(result.allowed).toBe(false);
  });

  it("admits any authenticated caller when no role is named", async () => {
    for (const role of [ROLES.ATTENDEE, ROLES.SPEAKER, ROLES.FACILITATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]) {
      vi.mocked(requireAuth).mockResolvedValue(user(role));

      await expect(requireRole()).resolves.toMatchObject({ allowed: true, user: { role } });
    }
  });
});
