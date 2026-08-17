import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { requireAuth, getRouteClient, routeAuth, sendTemplatedEmail } = vi.hoisted(() => {
  const routeAuth = { getUser: vi.fn(), updateUser: vi.fn() };
  return {
    requireAuth: vi.fn(),
    getRouteClient: vi.fn(async () => ({ auth: routeAuth })),
    routeAuth,
    sendTemplatedEmail: vi.fn(),
  };
});

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/route-client", () => ({ getRouteClient }));
vi.mock("@/shared/integrations/email/send-templated", () => ({ sendTemplatedEmail }));

import { POST } from "@/app/api/auth/email/send/route";
import { emailChangeAlertTemplate } from "@/shared/integrations/email/templates";

const USER = {
  id: 1,
  role: ROLES.ATTENDEE,
  full_name: "Ada",
  email: "ada@example.com",
  profile_image_url: null,
};

function send(email: unknown) {
  return new Request("https://app.test/api/auth/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
}

function goTrueUser(overrides: Record<string, unknown> = {}) {
  return { id: "auth_1", email: USER.email, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(USER);
  routeAuth.getUser.mockResolvedValue({ data: { user: goTrueUser() }, error: null });
  routeAuth.updateUser.mockResolvedValue({ error: null, data: { user: goTrueUser() } });
  sendTemplatedEmail.mockResolvedValue({ success: true });
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("POST /api/auth/email/send", () => {
  it("refuses an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
    expect(routeAuth.updateUser).not.toHaveBeenCalled();
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("rejects a request without a usable email before touching GoTrue", async () => {
    const res = await POST(send(undefined));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: { status: 400, message: "Bad request" } });
    expect(routeAuth.getUser).not.toHaveBeenCalled();
    expect(routeAuth.updateUser).not.toHaveBeenCalled();
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("treats an unparseable body as a bad request instead of crashing the route", async () => {
    const res = await POST(
      new Request("https://app.test/api/auth/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not json",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: { status: 400, message: "Bad request" } });
    expect(routeAuth.getUser).not.toHaveBeenCalled();
    expect(routeAuth.updateUser).not.toHaveBeenCalled();
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("refuses the address already on the account, whatever the casing or padding", async () => {
    for (const typed of [USER.email, "  ADA@example.com  "]) {
      const res = await POST(send(typed));

      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toEqual({
        ok: false,
        error: { status: 400, message: "This is already your email address." },
      });
      expect(routeAuth.updateUser).not.toHaveBeenCalled();
      expect(sendTemplatedEmail).not.toHaveBeenCalled();
    }
  });

  it("429s a re-send of a pending address inside the cooldown window", async () => {
    routeAuth.getUser.mockResolvedValue({
      data: {
        user: goTrueUser({
          new_email: "new@example.com",
          email_change_sent_at: new Date(Date.now() - 10_000).toISOString(),
        }),
      },
      error: null,
    });

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({ ok: false, error: { status: 429, message: "" } });
    expect(routeAuth.updateUser).not.toHaveBeenCalled();
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  // The elapsed seconds are measured from a field GoTrue does not always send.
  // Reading a missing one as zero gated the address for good: the window never
  // widened, and only a cancel clears the pending record it was gating on.
  it("sends when the pending change has no recorded send time", async () => {
    routeAuth.getUser.mockResolvedValue({
      data: { user: goTrueUser({ new_email: "new@example.com" }) },
      error: null,
    });

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    expect(routeAuth.updateUser).toHaveBeenCalled();
  });

  it("sends when the recorded send time cannot be parsed", async () => {
    routeAuth.getUser.mockResolvedValue({
      data: { user: goTrueUser({ new_email: "new@example.com", email_change_sent_at: "not-a-date" }) },
      error: null,
    });

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    expect(routeAuth.updateUser).toHaveBeenCalled();
  });

  it("sends once the cooldown window has actually passed", async () => {
    routeAuth.getUser.mockResolvedValue({
      data: {
        user: goTrueUser({
          new_email: "new@example.com",
          email_change_sent_at: new Date(Date.now() - 61_000).toISOString(),
        }),
      },
      error: null,
    });

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    expect(routeAuth.updateUser).toHaveBeenCalled();
  });

  it("lets a different address supersede a pending change instead of cooldown-gating it", async () => {
    routeAuth.getUser.mockResolvedValue({
      data: {
        user: goTrueUser({ new_email: "stale@example.com", email_change_sent_at: new Date().toISOString() }),
      },
      error: null,
    });

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(routeAuth.updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: "http://localhost:3000/api/auth/callback" },
    );
  });

  it("passes a provider rejection through verbatim for the client helper to map", async () => {
    routeAuth.updateUser.mockResolvedValue({ error: { status: 422, message: "Email already in use" } });

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: { status: 422, message: "Email already in use" },
    });
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("answers ok when the send lands", async () => {
    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(routeAuth.updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: "http://localhost:3000/api/auth/callback" },
    );
  });

  it("normalises a trailing slash off the configured app URL in the redirect target", async () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://app.test/";

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(routeAuth.updateUser).toHaveBeenCalledWith(
      { email: "new@example.com" },
      { emailRedirectTo: "https://app.test/api/auth/callback" },
    );
  });

  it("notifies the old address that the email is changing", async () => {
    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
    expect(sendTemplatedEmail).toHaveBeenCalledWith(
      emailChangeAlertTemplate,
      { name: "Ada", newEmail: "new@example.com" },
      { email: "ada@example.com", name: "Ada" },
    );
    expect(sendTemplatedEmail.mock.invocationCallOrder[0]).toBeGreaterThan(routeAuth.updateUser.mock.invocationCallOrder[0]);
  });

  it("still ok when the notice reports it could not send", async () => {
    sendTemplatedEmail.mockResolvedValue({ success: false });

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("still ok and logs when the notice throws", async () => {
    sendTemplatedEmail.mockRejectedValue(new Error("provider down"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await POST(send("new@example.com"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });
});
