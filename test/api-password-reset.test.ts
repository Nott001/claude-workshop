import { describe, it, expect, vi, beforeEach } from "vitest";

const { requestPasswordReset, confirmPasswordReset, getServiceClient, getRouteClient, findByAuthId, logAuditEvent } =
  vi.hoisted(() => ({
    requestPasswordReset: vi.fn(),
    confirmPasswordReset: vi.fn(),
    getServiceClient: vi.fn(() => ({})),
    getRouteClient: vi.fn(async () => ({})),
    findByAuthId: vi.fn(),
    logAuditEvent: vi.fn(),
  }));

vi.mock("@/modules/auth/lib/password-reset", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/auth/lib/password-reset")>()),
  requestPasswordReset,
  confirmPasswordReset,
}));
vi.mock("@/shared/db/client", () => ({ getServiceClient }));
vi.mock("@/shared/db/route-client", () => ({ getRouteClient }));
vi.mock("@/shared/db/dao/user.dao", () => ({ findByAuthId }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));

import { POST as recover } from "@/app/api/auth/recover/route";
import { POST as confirm } from "@/app/api/auth/recover/confirm/route";

const TOKEN = "aaaabbbbccccddddeeeeffff";
const PASSWORD = "a-long-enough-password";

function jsonReq(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://startuplab.center/api/auth/recover", {
    method: "POST",
    headers: { "Content-Type": "application/json", host: "startuplab.center", ...headers },
    body: JSON.stringify(body),
  });
}

function formReq(fields: Record<string, string>, headers: Record<string, string> = {}): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return new Request("https://startuplab.center/api/auth/recover/confirm", {
    method: "POST",
    headers: { host: "startuplab.center", ...headers },
    body: form,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requestPasswordReset.mockResolvedValue(undefined);
  confirmPasswordReset.mockResolvedValue({ ok: true, authUserId: "auth-1" });
  findByAuthId.mockResolvedValue({ id: 7 });
  logAuditEvent.mockResolvedValue(true);
});

describe("POST /api/auth/recover", () => {
  it("accepts a request and delegates it", async () => {
    const res = await recover(jsonReq({ email: "ada@example.com" }, { "cf-connecting-ip": "1.2.3.4" }));

    expect(res.status).toBe(200);
    expect(requestPasswordReset).toHaveBeenCalledWith({}, "ada@example.com", "1.2.3.4");
  });

  // Every rejected path has to look like every accepted one, or the route
  // becomes the enumeration oracle the service was written to avoid.
  it("answers identically for a malformed body, a bad address and a cross-site origin", async () => {
    const bodies = [
      await recover(jsonReq({ email: "not-an-email" })),
      await recover(jsonReq({})),
      await recover(jsonReq({ email: "ada@example.com" }, { origin: "https://evil.example" })),
    ];

    const ok = await recover(jsonReq({ email: "ada@example.com" }));

    for (const res of bodies) {
      expect(res.status).toBe(ok.status);
      expect(await res.clone().json()).toEqual(await ok.clone().json());
    }
  });

  it("does not run a reset for a cross-site origin", async () => {
    await recover(jsonReq({ email: "ada@example.com" }, { origin: "https://evil.example" }));

    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  it("allows a same-origin request", async () => {
    await recover(jsonReq({ email: "ada@example.com" }, { origin: "https://startuplab.center" }));

    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("passes a null IP through when the edge header is absent", async () => {
    await recover(jsonReq({ email: "ada@example.com" }));

    expect(requestPasswordReset).toHaveBeenCalledWith({}, "ada@example.com", null);
  });
});

describe("POST /api/auth/recover/confirm", () => {
  it("sets the password and redirects with 303", async () => {
    const res = await confirm(formReq({ token: TOKEN, password: PASSWORD, confirm: PASSWORD }));

    // 303 so a refresh of the destination cannot resubmit a spent token.
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain("/events");
    expect(confirmPasswordReset).toHaveBeenCalledWith({}, TOKEN, PASSWORD);
  });

  it("records the completion in the audit trail", async () => {
    await confirm(formReq({ token: TOKEN, password: PASSWORD, confirm: PASSWORD }));

    expect(logAuditEvent).toHaveBeenCalledWith({}, 7, "auth.password_reset_completed", "user", 7);
  });

  it("still completes when the auth account has no USER row to audit", async () => {
    findByAuthId.mockResolvedValue(null);

    const res = await confirm(formReq({ token: TOKEN, password: PASSWORD, confirm: PASSWORD }));

    expect(res.status).toBe(303);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  // A mistyped confirmation should cost a retry on the same link, not a whole
  // second reset email, so the token must survive.
  it("bounces a mismatch back to the form with the token intact", async () => {
    const res = await confirm(formReq({ token: TOKEN, password: PASSWORD, confirm: "something-else" }));

    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toContain(`/reset-password?token=${TOKEN}`);
    expect(res.headers.get("location")).toContain("error=mismatch");
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("bounces a weak password back to the form with the token intact", async () => {
    confirmPasswordReset.mockResolvedValue({ ok: false, reason: "weak_password" });

    const res = await confirm(formReq({ token: TOKEN, password: "short", confirm: "short" }));

    expect(res.headers.get("location")).toContain(`/reset-password?token=${TOKEN}`);
    expect(res.headers.get("location")).toContain("error=weak_password");
  });

  // A spent or forged token has no form worth returning to.
  it("sends an invalid token to sign-in rather than back to the form", async () => {
    confirmPasswordReset.mockResolvedValue({ ok: false, reason: "invalid_token" });

    const res = await confirm(formReq({ token: TOKEN, password: PASSWORD, confirm: PASSWORD }));

    expect(res.headers.get("location")).toContain("/sign-in?error=invalid_reset");
    expect(res.headers.get("location")).not.toContain(TOKEN);
  });

  it("rejects a malformed token before it reaches verifyOtp", async () => {
    const res = await confirm(formReq({ token: "../etc/passwd", password: PASSWORD, confirm: PASSWORD }));

    expect(res.headers.get("location")).toContain("/sign-in?error=invalid_reset");
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("refuses a cross-site origin", async () => {
    const res = await confirm(
      formReq({ token: TOKEN, password: PASSWORD, confirm: PASSWORD }, { origin: "https://evil.example" }),
    );

    expect(res.headers.get("location")).toContain("/sign-in?error=invalid_reset");
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });
});
