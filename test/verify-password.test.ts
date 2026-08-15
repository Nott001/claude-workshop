import { describe, it, expect, vi, beforeEach } from "vitest";

const { createClient, signInWithPassword, signOut } = vi.hoisted(() => ({
  createClient: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { verifyPassword } from "@/modules/auth/lib/verify-password";

beforeEach(() => {
  vi.clearAllMocks();
  createClient.mockReturnValue({ auth: { signInWithPassword, signOut } });
  signInWithPassword.mockResolvedValue({ error: null });
});

describe("verifyPassword", () => {
  it("confirms the password the account actually has", async () => {
    await expect(verifyPassword("ada@example.com", "right-one")).resolves.toBe(true);
    expect(signInWithPassword).toHaveBeenCalledWith({ email: "ada@example.com", password: "right-one" });
  });

  it("denies one the account does not have", async () => {
    signInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });

    await expect(verifyPassword("ada@example.com", "wrong-one")).resolves.toBe(false);
  });

  // Signing in on the shared client would swap the live session on every check,
  // emitting SIGNED_IN and sending the shell through a refetch to end up where
  // it began. This client is kept out of storage so it cannot.
  it("checks on a client that neither persists nor refreshes a session", async () => {
    await verifyPassword("ada@example.com", "right-one");

    const [, , options] = createClient.mock.calls[0];
    expect(options.auth).toMatchObject({
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    });
  });

  // signOut revokes every session the user holds unless told otherwise, which
  // would turn a password check into being logged out everywhere.
  it("never signs out, which would take the real session down with it", async () => {
    await verifyPassword("ada@example.com", "right-one");

    expect(signOut).not.toHaveBeenCalled();
  });
});
