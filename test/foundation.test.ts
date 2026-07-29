import { describe, it, expect, vi } from "vitest";
import type { User, UserRole } from "@/shared/types";

vi.mock("@/modules/auth/lib/session", () => ({
  requireAuth: vi.fn(),
}));

describe("User types", () => {
  it("has the correct shape", () => {
    const user: User = {
      id: 1,
      full_name: "Test User",
      email: "test@example.com",
      auth_user_id: "auth_123",
      role: "attendee",
      profile_image_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(user.id).toBe(1);
    expect(user.role).toBe("attendee");
  });

  it("accepts all valid roles", () => {
    const roles: UserRole[] = ["attendee", "speaker", "facilitator"];
    expect(roles).toHaveLength(3);
  });
});

describe("requireRole", () => {
  it("returns Unauthenticated when no user", async () => {
    const { requireAuth } = await import("@/modules/auth/lib/session");
    vi.mocked(requireAuth).mockResolvedValue(null);

    const { requireRole } = await import("@/modules/auth/lib/role-guard");
    const result = await requireRole("facilitator");

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Unauthenticated");
  });

  it("returns Forbidden when user role is not allowed", async () => {
    const { requireAuth } = await import("@/modules/auth/lib/session");
    vi.mocked(requireAuth).mockResolvedValue({ id: 1, role: "attendee", full_name: "Test", email: "test@test.com", profile_image_url: null });

    const { requireRole } = await import("@/modules/auth/lib/role-guard");
    const result = await requireRole("facilitator");

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Forbidden");
  });

  it("returns allowed when user role matches", async () => {
    const { requireAuth } = await import("@/modules/auth/lib/session");
    vi.mocked(requireAuth).mockResolvedValue({ id: 1, role: "facilitator", full_name: "Admin", email: "admin@test.com", profile_image_url: null });

    const { requireRole } = await import("@/modules/auth/lib/role-guard");
    const result = await requireRole("facilitator");

    expect(result.allowed).toBe(true);
    expect(result.error).toBeNull();
  });
});
