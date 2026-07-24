import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(),
  clerkClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getServiceClient: vi.fn(),
}));

function mockSingle(value: unknown) {
  return vi.fn().mockResolvedValue(value);
}

describe("currentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when not authenticated", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: null, sessionId: null, actor: undefined });

    const { currentUser } = await import("@/lib/auth/current-user");
    const result = await currentUser();

    expect(result).toBeNull();
  });

  it("returns user when authenticated and found in DB", async () => {
    const existingUser = { user_id: 1, role: "attendee", full_name: "Test User", email: "test@example.com" };

    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_123", sessionId: "sess_123", actor: undefined });

    const { getServiceClient } = await import("@/lib/db");
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle({ data: existingUser, error: null }),
    });
    vi.mocked(getServiceClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getServiceClient>);

    const { currentUser } = await import("@/lib/auth/current-user");
    const result = await currentUser();

    expect(result).toEqual(existingUser);
  });

  it("returns null when syncUser returns null", async () => {
    const { auth } = await import("@clerk/nextjs/server");
    vi.mocked(auth).mockResolvedValue({ userId: "clerk_456", sessionId: "sess_456", actor: undefined });

    const { getServiceClient } = await import("@/lib/db");
    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: mockSingle({ data: null, error: null }),
      }),
    } as unknown as ReturnType<typeof getServiceClient>);

    const { clerkClient } = await import("@clerk/nextjs/server");
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        getUser: vi.fn().mockRejectedValue(new Error("Not found")),
      },
    } as unknown as Awaited<ReturnType<typeof clerkClient>>);

    const { currentUser } = await import("@/lib/auth/current-user");
    const result = await currentUser();

    expect(result).toBeNull();
  });
});
