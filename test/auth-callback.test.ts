import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeCodeForSession = vi.fn();
const { syncEmailFromAuth } = vi.hoisted(() => ({ syncEmailFromAuth: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { exchangeCodeForSession } }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));
vi.mock("@/modules/auth/lib/sync-email", () => ({ syncEmailFromAuth }));

import { GET } from "@/app/api/auth/callback/route";

/** What Supabase hands back once a confirmation link has been redeemed. */
function exchanged(email: string | null = "new@example.com") {
  return { data: { user: { id: "auth_123", email } }, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/auth/callback", () => {
  it("redirects to /email-verified when the code exchange succeeds", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const req = new Request("https://app.test/api/auth/callback?code=valid_code");
    const res = await GET(req);

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/email-verified");
  });

  it("forwards a safe redirect_url to /email-verified", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const req = new Request("https://app.test/api/auth/callback?code=valid_code&redirect_url=%2Fevents%2F5");
    const res = await GET(req);

    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/email-verified");
    expect(location.searchParams.get("redirect_url")).toBe("/events/5");
  });

  it("drops an unsafe redirect_url on success", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: null });

    const req = new Request("https://app.test/api/auth/callback?code=valid_code&redirect_url=https%3A%2F%2Fevil.com");
    const res = await GET(req);

    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/email-verified");
    expect(location.searchParams.has("redirect_url")).toBe(false);
  });

  it("redirects to /sign-in with error when the code exchange fails", async () => {
    exchangeCodeForSession.mockResolvedValue({ error: new Error("invalid code") });

    const req = new Request("https://app.test/api/auth/callback?code=bad_code");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("error")).toBe("auth_failed");
  });

  it("redirects to /sign-in with error when no code is present", async () => {
    const req = new Request("https://app.test/api/auth/callback");
    const res = await GET(req);

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("error")).toBe("auth_failed");
    expect(exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("brings the app row up to the address the exchange confirmed", async () => {
    exchangeCodeForSession.mockResolvedValue(exchanged("new@example.com"));

    const req = new Request("https://app.test/api/auth/callback?code=valid_code");
    await GET(req);

    expect(syncEmailFromAuth).toHaveBeenCalledWith("auth_123", "new@example.com");
  });

  it("copies nothing when the exchange fails, because no address was confirmed", async () => {
    exchangeCodeForSession.mockResolvedValue({ data: null, error: new Error("invalid code") });

    const req = new Request("https://app.test/api/auth/callback?code=bad_code");
    await GET(req);

    expect(syncEmailFromAuth).not.toHaveBeenCalled();
  });

  // The identity has already moved by this point; refusing to verify over a
  // failed mirror would strand the account between two addresses.
  it("still verifies when the row could not be brought up to date", async () => {
    exchangeCodeForSession.mockResolvedValue(exchanged());
    syncEmailFromAuth.mockRejectedValue(new Error("db down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("https://app.test/api/auth/callback?code=valid_code");
    const res = await GET(req);

    expect(new URL(res.headers.get("location")!).pathname).toBe("/email-verified");
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });
});
