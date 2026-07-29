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
  const protectedPaths = [
    "/staff",
    "/staff/events",
    "/staff/events/new",
    "/staff/organization",
    "/staff/kiosk",
    "/api/events",
    "/api/tickets/1",
    "/api/checkin",
  ];

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
    const res = await middleware(request("/staff/events"));

    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/sign-in");
    expect(location.searchParams.get("redirect_url")).toBe("/staff/events");
  });
});

describe("public routes", () => {
  it.each(["/", "/events", "/sign-in", "/sign-up"])("serves %s without a session", async (path) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path));
    expect(res.status).toBe(200);
  });
});

// The middleware only guards /staff/ and /api/ routes. Page-level components
// are expected to gate their own content. See SPEC-09-TEST-STRATEGY §3 (P1).
describe("routes the middleware does NOT protect", () => {
  it.each(["/events/1/edit", "/payments", "/tickets", "/speaker/dashboard"])("reaches %s without a session", async (path) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
