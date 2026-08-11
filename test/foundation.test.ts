import { ROLES } from "@/shared/lib/roles";
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
      role: ROLES.ATTENDEE,
      profile_image_url: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(user.id).toBe(1);
    expect(user.role).toBe(ROLES.ATTENDEE);
  });

  it("accepts all valid roles", () => {
    const roles: UserRole[] = [ROLES.ATTENDEE, ROLES.SPEAKER, ROLES.FACILITATOR];
    expect(roles).toHaveLength(3);
  });
});
