import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { middleware } from "@/middleware";

function request(pathname: string) {
  return new NextRequest(new URL(pathname, "https://app.test"));
}

const signedOut = { data: { user: null } };
const signedIn = { data: { user: { id: "auth_123" } } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("route protection", () => {
  const protectedPaths = ["/courses", "/courses/1", "/kiosk", "/organization", "/api/events", "/api/tickets/1", "/api/checkin"];

  it.each(protectedPaths)("redirects signed-out users away from %s", async (path) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path));

    if (path.startsWith("/api/")) {
      expect(res.status).toBe(401);
    } else {
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe("/sign-in");
    }
  });

  it.each(protectedPaths)("lets signed-in users through to %s", async (path) => {
    getUser.mockResolvedValue(signedIn);
    const res = await middleware(request(path));
    expect(res.status).toBe(200);
  });
});

describe("api responses", () => {
  it("answers unauthenticated api calls with 401 json, never a redirect", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/events"));

    expect(res.status).toBe(401);
    expect(res.headers.get("location")).toBeNull();
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("leaves the auth callback reachable so sign-in can complete", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/auth/callback"));
    expect(res.status).toBe(200);
  });
});

describe("sign-in redirect", () => {
  it("preserves the target path so the user lands where they intended", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/courses/42"));

    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("redirect_url")).toBe("/courses/42");
  });
});

describe("public routes", () => {
  it.each(["/", "/events", "/sign-in", "/sign-up"])("serves %s without a session", async (path) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path));
    expect(res.status).toBe(200);
  });
});

// These pass today because isProtectedRoute only guards /courses, /kiosk,
// /organization and /api. The pages themselves are expected to gate their own
// content. Recorded so that the exposure is visible and any change to it is a
// deliberate edit rather than a silent behaviour shift. See SPEC-07 §3 (P1).
describe("routes the middleware does NOT protect", () => {
  it.each([
    "/events/1/edit",
    "/events/new",
    "/events/1/speakers",
    "/payments",
    "/tickets",
    "/audit-logs",
    "/speakers/dashboard",
  ])("reaches %s without a session", async (path) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
