import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@clerk/nextjs/server", () => ({
  clerkClient: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  getServiceClient: vi.fn(),
}));

function mockSingle(value: unknown) {
  return vi.fn().mockResolvedValue(value);
}

describe("syncUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns existing user when found in Supabase", async () => {
    const existingUser = { user_id: 1, role: "attendee", full_name: "Test User", email: "test@example.com" };

    const { getServiceClient } = await import("@/lib/db");
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle({ data: existingUser, error: null }),
    });
    vi.mocked(getServiceClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getServiceClient>);

    const { syncUser } = await import("@/lib/auth/sync-user");
    const result = await syncUser("clerk_123");

    expect(result).toEqual(existingUser);
  });

  it("creates user in Supabase when not found", async () => {
    const newUser = { user_id: 2, role: "attendee", full_name: "New User", email: "new@example.com" };

    const { getServiceClient } = await import("@/lib/db");
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle({ data: null, error: null }),
    };
    const upsertChain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: mockSingle({ data: newUser, error: null }),
    };
    const mockFrom = vi.fn()
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(upsertChain);
    vi.mocked(getServiceClient).mockReturnValue({
      from: mockFrom,
    } as unknown as ReturnType<typeof getServiceClient>);

    const { clerkClient } = await import("@clerk/nextjs/server");
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          firstName: "New",
          lastName: "User",
          emailAddresses: [{ emailAddress: "new@example.com" }],
          publicMetadata: {},
        }),
      },
    } as unknown as Awaited<ReturnType<typeof clerkClient>>);

    const { syncUser } = await import("@/lib/auth/sync-user");
    const result = await syncUser("clerk_456");

    expect(result).toEqual(newUser);
  });

  it("returns null when Clerk API fails", async () => {
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

    const { syncUser } = await import("@/lib/auth/sync-user");
    const result = await syncUser("clerk_nonexistent");

    expect(result).toBeNull();
  });

  it("returns null when Supabase insert fails", async () => {
    const { getServiceClient } = await import("@/lib/db");
    const selectChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: mockSingle({ data: null, error: null }),
    };
    const upsertChain = {
      upsert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: mockSingle({ data: null, error: { message: "Insert failed" } }),
    };
    vi.mocked(getServiceClient).mockReturnValue({
      from: vi.fn()
        .mockReturnValueOnce(selectChain)
        .mockReturnValueOnce(upsertChain),
    } as unknown as ReturnType<typeof getServiceClient>);

    const { clerkClient } = await import("@clerk/nextjs/server");
    vi.mocked(clerkClient).mockResolvedValue({
      users: {
        getUser: vi.fn().mockResolvedValue({
          firstName: "Test",
          lastName: "",
          emailAddresses: [{ emailAddress: "fail@example.com" }],
          publicMetadata: { role: "speaker" },
        }),
      },
    } as unknown as Awaited<ReturnType<typeof clerkClient>>);

    const { syncUser } = await import("@/lib/auth/sync-user");
    const result = await syncUser("clerk_fail");

    expect(result).toBeNull();
  });
});
