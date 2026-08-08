import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getUserById, upsertUser } = vi.hoisted(() => ({
  getUserById: vi.fn(),
  upsertUser: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ tag: "service", auth: { admin: { getUserById } } }),
}));
vi.mock("@/shared/db/dao/user.dao", () => ({ upsertUser }));

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
      role: ROLES.ATTENDEE,
    });

    const result = await ensureUser(fakeServiceClient, "auth_123");

    expect(upsertUser).toHaveBeenCalledWith(fakeServiceClient, {
      auth_user_id: "auth_123",
      email: "jane@example.com",
      full_name: "Jane Doe",
      role: ROLES.ATTENDEE,
    });
    expect(result).toMatchObject({ email: "jane@example.com", full_name: "Jane Doe" });
  });

  it("falls back to empty strings when Auth metadata is missing", async () => {
    getUserById.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    upsertUser.mockResolvedValue({ id: 1, auth_user_id: "auth_123", email: "", full_name: "", role: ROLES.ATTENDEE });

    const result = await ensureUser(fakeServiceClient, "auth_123");

    expect(upsertUser).toHaveBeenCalledWith(fakeServiceClient, {
      auth_user_id: "auth_123",
      email: "",
      full_name: "",
      role: ROLES.ATTENDEE,
    });
    expect(result).toMatchObject({ email: "", full_name: "" });
  });

  it("grants the role an organization invite recorded", async () => {
    getUserById.mockResolvedValue({
      data: {
        user: {
          email: "speaker@example.com",
          user_metadata: { full_name: "Sam Speaker" },
          app_metadata: { invited_role: ROLES.FACILITATOR },
        },
      },
      error: null,
    });
    upsertUser.mockResolvedValue({ id: 2, email: "speaker@example.com", full_name: "Sam Speaker", role: ROLES.FACILITATOR });

    const result = await ensureUser(fakeServiceClient, "auth_456");

    expect(upsertUser).toHaveBeenCalledWith(fakeServiceClient, expect.objectContaining({ role: ROLES.FACILITATOR }));
    expect(result).toMatchObject({ role: ROLES.FACILITATOR });
  });

  it("ignores a role planted in user_metadata", async () => {
    // user_metadata is writable by the account holder through
    // supabase.auth.updateUser, so honouring it would be self-service admin.
    getUserById.mockResolvedValue({
      data: {
        user: {
          email: "sneaky@example.com",
          user_metadata: { full_name: "Sneaky", invited_role: ROLES.ADMIN, role: ROLES.ADMIN },
          app_metadata: {},
        },
      },
      error: null,
    });
    upsertUser.mockResolvedValue({ id: 3, email: "sneaky@example.com", full_name: "Sneaky", role: ROLES.ATTENDEE });

    await ensureUser(fakeServiceClient, "auth_789");

    expect(upsertUser).toHaveBeenCalledWith(fakeServiceClient, expect.objectContaining({ role: ROLES.ATTENDEE }));
  });

  it("refuses a super_admin grant even from app_metadata", async () => {
    getUserById.mockResolvedValue({
      data: {
        user: { email: "root@example.com", user_metadata: {}, app_metadata: { invited_role: ROLES.SUPER_ADMIN } },
      },
      error: null,
    });
    upsertUser.mockResolvedValue({ id: 4, email: "root@example.com", full_name: "", role: ROLES.ATTENDEE });

    await ensureUser(fakeServiceClient, "auth_root");

    expect(upsertUser).toHaveBeenCalledWith(fakeServiceClient, expect.objectContaining({ role: ROLES.ATTENDEE }));
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
