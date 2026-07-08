import { describe, it, expect, vi } from "vitest";
import type { User, UserRole } from "@/types";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getServiceClient: vi.fn(),
}));

describe("User types", () => {
  it("has the correct shape", () => {
    const user: User = {
      user_id: 1,
      full_name: "Test User",
      email: "test@example.com",
      clerk_id: "clerk_123",
      role: "attendee",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    expect(user.user_id).toBe(1);
    expect(user.role).toBe("attendee");
  });

  it("accepts all valid roles", () => {
    const roles: UserRole[] = ["attendee", "speaker", "facilitator"];
    expect(roles).toHaveLength(3);
  });
});

describe("requireRole", () => {
  it("returns Unauthenticated when no userId", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionId: null, actor: null, sessionClaims: null, orgId: null, orgRole: null, orgSlug: null, permissions: null, debug: null, getToken: vi.fn(), has: vi.fn(), redirectToSignIn: vi.fn(), protect: vi.fn() });

    const { requireRole } = await import("@/lib/auth/role-guard");
    const result = await requireRole("facilitator");

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Unauthenticated");
  });

  it("returns Forbidden when user role is not allowed", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_123", sessionId: null, actor: null, sessionClaims: null, orgId: null, orgRole: null, orgSlug: null, permissions: null, debug: null, getToken: vi.fn(), has: vi.fn(), redirectToSignIn: vi.fn(), protect: vi.fn() });

    const { getServiceClient } = await import("@/lib/db");
    const mockSelect = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockSingle = vi.fn().mockResolvedValue({ data: { role: "attendee" }, error: null });

    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ select: mockSelect, eq: mockEq, single: mockSingle }),
    } as any);

    const { requireRole } = await import("@/lib/auth/role-guard");
    const result = await requireRole("facilitator");

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Forbidden");
  });
});
