import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUserById, upsertUser } = vi.hoisted(() => ({
  getUserById: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ tag: "service", auth: { admin: { getUserById } } }),
}));
vi.mock("@/shared/db/dao", () => ({ userDao: { upsertUser } }));

import { ensureUser } from "@/modules/auth/lib/ensure-user";

const fakeServiceClient = { tag: "service", auth: { admin: { getUserById } } } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ensureUser", () => {
  it("fetches email and full_name from Auth metadata when available", async () => {
    getUserById.mockResolvedValue({
      data: { user: { email: "jane@example.com", user_metadata: { full_name: "Jane Doe" } } },
      error: null,
    });
    upsertUser.mockResolvedValue({
      id: 1,
      auth_user_id: "auth_123",
      email: "jane@example.com",
      full_name: "Jane Doe",
      role: "attendee",
    });

    const result = await ensureUser(fakeServiceClient, "auth_123");

    expect(upsertUser).toHaveBeenCalledWith(fakeServiceClient, {
      auth_user_id: "auth_123",
      email: "jane@example.com",
      full_name: "Jane Doe",
      role: "attendee",
    });
    expect(result).toMatchObject({ email: "jane@example.com", full_name: "Jane Doe" });
  });

  it("falls back to empty strings when Auth metadata is missing", async () => {
    getUserById.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    upsertUser.mockResolvedValue({ id: 1, auth_user_id: "auth_123", email: "", full_name: "", role: "attendee" });

    const result = await ensureUser(fakeServiceClient, "auth_123");

    expect(upsertUser).toHaveBeenCalledWith(fakeServiceClient, {
      auth_user_id: "auth_123",
      email: "",
      full_name: "",
      role: "attendee",
    });
    expect(result).toMatchObject({ email: "", full_name: "" });
  });

  it("returns null when upsertUser fails", async () => {
    getUserById.mockResolvedValue({
      data: { user: { email: "jane@example.com", user_metadata: { full_name: "Jane Doe" } } },
      error: null,
    });
    upsertUser.mockResolvedValue(null);

    const result = await ensureUser(fakeServiceClient, "auth_123");

    expect(result).toBeNull();
  });
});
