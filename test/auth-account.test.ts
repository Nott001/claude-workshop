import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { findAuthAccountByEmail } from "@/modules/auth/lib/auth-account";

const fetchMock = vi.fn();

function reply(users: unknown[], ok = true) {
  return { ok, json: async () => ({ users }) };
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("findAuthAccountByEmail", () => {
  it("asks Supabase for the one address rather than paging every account", async () => {
    fetchMock.mockResolvedValue(reply([]));

    await findAuthAccountByEmail("jane@example.com");

    const url = new URL(fetchMock.mock.calls[0][0]);
    expect(url.pathname).toBe("/auth/v1/admin/users");
    expect(url.searchParams.get("filter")).toBe("jane@example.com");
  });

  it("calls as the service role, the only role allowed to read auth accounts", async () => {
    fetchMock.mockResolvedValue(reply([]));

    await findAuthAccountByEmail("jane@example.com");

    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      apikey: "service-key",
      Authorization: "Bearer service-key",
    });
  });

  it("treats an account that has never signed in as an unaccepted invitation", async () => {
    // Confirmed, because a mail scanner followed the link — but no person ever
    // arrived, so the invitation is still open.
    fetchMock.mockResolvedValue(reply([{ id: "auth-1", email: "jane@example.com", last_sign_in_at: null }]));

    expect(await findAuthAccountByEmail("jane@example.com")).toEqual({ id: "auth-1", accepted: false });
  });

  it("treats a sign-in as acceptance", async () => {
    fetchMock.mockResolvedValue(reply([{ id: "auth-1", email: "jane@example.com", last_sign_in_at: "2026-08-05T00:00:00Z" }]));

    expect(await findAuthAccountByEmail("jane@example.com")).toEqual({ id: "auth-1", accepted: true });
  });

  it("ignores the near misses the substring filter drags in", async () => {
    fetchMock.mockResolvedValue(reply([{ id: "auth-2", email: "jane@example.com.mx", last_sign_in_at: null }]));

    expect(await findAuthAccountByEmail("jane@example.com")).toBeNull();
  });

  it("matches regardless of the case the address was typed in", async () => {
    fetchMock.mockResolvedValue(reply([{ id: "auth-1", email: "Jane@Example.com", last_sign_in_at: null }]));

    expect(await findAuthAccountByEmail("jane@example.com")).toEqual({ id: "auth-1", accepted: false });
  });

  it("reports no account when the lookup itself fails", async () => {
    fetchMock.mockResolvedValue(reply([], false));

    expect(await findAuthAccountByEmail("jane@example.com")).toBeNull();
  });
});
