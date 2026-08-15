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

// NextRequest's init is not the DOM RequestInit (different signal type), so
// derive the exact type the constructor accepts instead of guessing.
type NextRequestInit = NonNullable<ConstructorParameters<typeof NextRequest>[1]>;

function request(pathname: string, init?: NextRequestInit) {
  return new NextRequest(new URL(pathname, "https://app.test"), init);
}

const signedOut = { data: { user: null } };
const signedIn = { data: { user: { id: "auth_123" } } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("route protection", () => {
  // API paths are exercised as writes: anonymous GETs to the public event
  // endpoints are allowed through, so a mutation is what must be refused.
  const protectedPaths: [string, NextRequestInit | undefined][] = [
    ["/staff", undefined],
    ["/staff/events", undefined],
    ["/staff/events/new", undefined],
    ["/staff/community", undefined],
    ["/staff/organization", undefined],
    ["/staff/kiosk", undefined],
    ["/speaker/events", undefined],
    ["/speaker/events/42/course", undefined],
    ["/api/events", { method: "POST" }],
    ["/api/community", { method: "POST" }],
    ["/api/tickets/1", undefined],
    ["/api/checkin", undefined],
    ["/api/checkin/lookup", undefined],
  ];

  it.each(protectedPaths)("redirects signed-out users away from %s", async (path, init) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path, init));

    if (path.startsWith("/api/")) {
      expect(res.status).toBe(401);
    } else {
      expect(res.status).toBe(307);
      const location = new URL(res.headers.get("location")!);
      expect(location.pathname).toBe("/sign-in");
    }
  });

  it.each(protectedPaths)("lets signed-in users through to %s", async (path, init) => {
    getUser.mockResolvedValue(signedIn);
    const res = await middleware(request(path, init));
    expect(res.status).toBe(200);
  });
});

describe("api responses", () => {
  it("answers unauthenticated api writes with 401 json, never a redirect", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/events", { method: "POST" }));

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

describe("public event reads", () => {
  it.each(["/api/events", "/api/events/42", "/api/community"])(
    "lets an anonymous GET on %s reach the handler",
    async (path) => {
      getUser.mockResolvedValue(signedOut);
      const res = await middleware(request(path));
      expect(res.status).toBe(200);
    },
  );

  it("still refuses anonymous writes to the event endpoints", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/events", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it.each([
    "/api/events/1/register",
    "/api/events/1/attendees",
    "/api/events/1/publish",
    "/api/events/1/survey",
    "/api/events/1/survey/send",
  ])("keeps %s behind the middleware", async (path) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path));
    expect(res.status).toBe(401);
  });
});

// Survey links are emailed to attendees with no session, so the token routes
// must pass through the middleware; the random token is the only credential.
describe("public survey routes", () => {
  it("lets an anonymous GET on a survey token reach the handler", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/surveys/abc123"));
    expect(res.status).toBe(200);
  });

  it("lets an anonymous POST of a submission reach the handler", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/surveys/abc123/submit", { method: "POST" }));
    expect(res.status).toBe(200);
  });

  it("does not open a nested survey path beyond submit", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/surveys/abc123/admin", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

describe("public community reads", () => {
  it.each(["/api/community/1", "/api/community/999"])("keeps %s behind the middleware", async (path) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path));
    expect(res.status).toBe(401);
  });

  it("still refuses anonymous writes to the community endpoint", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/community", { method: "POST" }));
    expect(res.status).toBe(401);
  });
});

// Covers are stored as /api/storage/event_images/... and rendered on `/` and
// `/events`. While the matcher gated them, every cover 401'd for a logged-out
// visitor. The route still decides whether the event is published.
describe("public cover images", () => {
  it("lets an anonymous GET on a cover reach the storage handler", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/storage/event_images/events/42/cover.png"));
    expect(res.status).toBe(200);
  });

  it("refuses a write to the cover path — only reads are public", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/storage/event_images/events/42/cover.png", { method: "DELETE" }));
    expect(res.status).toBe(401);
  });

  it("does not open the bucket root by prefix match", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/storage/event_images_private/secrets.png"));
    expect(res.status).toBe(401);
  });
});

// The course-schedule card and the speaker avatars on the public event detail
// page must render for guests, so the middleware lets the GETs through and the
// handlers decide what to expose (drafts and non-speaker photos are refused
// there, not here).
describe("public schedule and speaker avatars", () => {
  it("lets an anonymous GET on an event schedule reach the handler", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/events/42/schedule"));
    expect(res.status).toBe(200);
  });

  it("still refuses anonymous writes to the schedule endpoint", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/events/42/schedule", { method: "POST" }));
    expect(res.status).toBe(401);
  });

  it("lets an anonymous GET on a speaker avatar reach the storage handler", async () => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request("/api/storage/profile_images/users/5/profile.png"));
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

    const res = await middleware(request("/api/events", { method: "POST" }));

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

// The middleware only guards /staff/, /speaker/ and /api/ routes. Page-level
// components are expected to gate their own content. See SPEC-09-TEST-STRATEGY §3 (P1).
describe("routes the middleware does NOT protect", () => {
  it.each(["/events/1/edit", "/payments", "/tickets"])("reaches %s without a session", async (path) => {
    getUser.mockResolvedValue(signedOut);
    const res = await middleware(request(path));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
  });
});
