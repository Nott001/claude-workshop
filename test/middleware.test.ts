import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: Record<string, unknown> };
type CookieMethods = {
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: CookieToSet[], headers: Record<string, string>) => void;
};

// The middleware hands its cookie plumbing to createServerClient, so the tests
// reach it the same way Supabase does: capture the methods, then call setAll.
const { getUser, captured } = vi.hoisted(() => ({
  getUser: vi.fn(),
  captured: {} as { cookies?: CookieMethods },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (_url: string, _key: string, options: { cookies: CookieMethods }) => {
    captured.cookies = options.cookies;
    return { auth: { getUser } };
  },
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

describe("session cookie handling", () => {
  const noStore = {
    "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
    Expires: "0",
    Pragma: "no-cache",
  };

  /** Stands in for a token refresh: Supabase writes cookies mid-getUser. */
  function refreshing(cookies: CookieToSet[], headers: Record<string, string> = noStore) {
    return async () => {
      captured.cookies!.setAll(cookies, headers);
      return signedIn;
    };
  }

  const chunkedToken: CookieToSet[] = [
    { name: "sb-auth-token.0", value: "first-half", options: { path: "/" } },
    { name: "sb-auth-token.1", value: "second-half", options: { path: "/" } },
  ];

  it("keeps every cookie of a refreshed session, not just the last one", async () => {
    getUser.mockImplementation(refreshing(chunkedToken));

    const res = await middleware(request("/events"));

    expect(res.cookies.get("sb-auth-token.0")?.value).toBe("first-half");
    expect(res.cookies.get("sb-auth-token.1")?.value).toBe("second-half");
  });

  it("reads the request's cookies back to Supabase", async () => {
    getUser.mockResolvedValue(signedIn);
    const req = request("/events");
    req.cookies.set("sb-auth-token.0", "stored");

    await middleware(req);

    expect(captured.cookies!.getAll()).toEqual(expect.arrayContaining([{ name: "sb-auth-token.0", value: "stored" }]));
  });

  it("marks a response carrying a new session as uncacheable", async () => {
    getUser.mockImplementation(refreshing(chunkedToken));

    const res = await middleware(request("/events"));

    expect(res.headers.get("cache-control")).toBe(noStore["Cache-Control"]);
    expect(res.headers.get("pragma")).toBe("no-cache");
  });

  it("carries cleared cookies onto a 401 so an expired session cannot loop", async () => {
    getUser.mockImplementation(async () => {
      captured.cookies!.setAll([{ name: "sb-auth-token.0", value: "", options: { path: "/", maxAge: 0 } }], noStore);
      return signedOut;
    });

    const res = await middleware(request("/api/events"));

    expect(res.status).toBe(401);
    expect(res.cookies.get("sb-auth-token.0")?.value).toBe("");
  });

  it("carries cleared cookies onto the sign-in redirect too", async () => {
    getUser.mockImplementation(async () => {
      captured.cookies!.setAll([{ name: "sb-auth-token.0", value: "", options: { path: "/", maxAge: 0 } }], noStore);
      return signedOut;
    });

    const res = await middleware(request("/staff/events"));

    expect(res.status).toBe(307);
    expect(res.cookies.get("sb-auth-token.0")?.value).toBe("");
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
