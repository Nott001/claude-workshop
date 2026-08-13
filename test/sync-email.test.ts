import { describe, it, expect, vi, beforeEach } from "vitest";

const { findByAuthId, updateUser } = vi.hoisted(() => ({ findByAuthId: vi.fn(), updateUser: vi.fn() }));

vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/user.dao", () => ({ findByAuthId, updateUser }));

import { syncEmailFromAuth } from "@/modules/auth/lib/sync-email";

beforeEach(() => {
  vi.clearAllMocks();
  updateUser.mockResolvedValue({ id: 1 });
});

describe("syncEmailFromAuth", () => {
  it("writes the confirmed address onto a row still holding the old one", async () => {
    findByAuthId.mockResolvedValue({ id: 1, email: "old@example.com" });

    await syncEmailFromAuth("auth_123", "new@example.com");

    expect(updateUser).toHaveBeenCalledWith(expect.anything(), "auth_123", { email: "new@example.com" });
  });

  it("writes nothing when the row already carries the confirmed address", async () => {
    findByAuthId.mockResolvedValue({ id: 1, email: "same@example.com" });

    await syncEmailFromAuth("auth_123", "same@example.com");

    expect(updateUser).not.toHaveBeenCalled();
  });

  // Supabase lowercases what it stores; a row written before that did not.
  it("treats a case or whitespace difference as the same address", async () => {
    findByAuthId.mockResolvedValue({ id: 1, email: "  Ada@Example.com " });

    await syncEmailFromAuth("auth_123", "ada@example.com");

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("leaves a first sign-in alone, because ensureUser is about to create the row", async () => {
    findByAuthId.mockResolvedValue(null);

    await syncEmailFromAuth("auth_123", "new@example.com");

    expect(updateUser).not.toHaveBeenCalled();
  });

  it("does not reach the database when the exchange carried no user", async () => {
    await syncEmailFromAuth(undefined, undefined);
    await syncEmailFromAuth("auth_123", null);
    await syncEmailFromAuth(null, "new@example.com");

    expect(findByAuthId).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });
});
