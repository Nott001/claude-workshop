import { describe, it, expect, vi, beforeEach } from "vitest";

const exchangeCodeForSession = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { exchangeCodeForSession } }),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: vi.fn() }),
}));

import { GET } from "@/app/api/auth/callback/route";

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
});
