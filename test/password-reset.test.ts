import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import {
  preparePasswordReset,
  confirmPasswordReset,
  normalizeEmail,
  RESET_MAX_PER_EMAIL,
  RESET_MAX_PER_IP,
} from "@/modules/auth/lib/password-reset";
import { MIN_PASSWORD_LENGTH } from "@/shared/lib/password-policy";

const { recordAttempt, countByEmail, countByIp, sendTemplatedEmail, generateLink, verifyOtp, updateUser } = vi.hoisted(() => ({
  recordAttempt: vi.fn(),
  countByEmail: vi.fn(),
  countByIp: vi.fn(),
  sendTemplatedEmail: vi.fn(),
  generateLink: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/shared/db/dao/password-reset.dao", () => ({ recordAttempt, countByEmail, countByIp }));
vi.mock("@/shared/integrations/email/send-templated", () => ({ sendTemplatedEmail }));

const supabase = { auth: { admin: { generateLink }, verifyOtp, updateUser } } as unknown as DbClient;
const TOKEN = "aaaabbbbccccddddeeeeffff";
const EMAIL = "ada@example.com";

beforeEach(() => {
  vi.clearAllMocks();
  countByEmail.mockResolvedValue(1);
  countByIp.mockResolvedValue(1);
  generateLink.mockResolvedValue({
    data: { user: { user_metadata: { full_name: "Ada" } }, properties: { hashed_token: TOKEN } },
    error: null,
  });
  sendTemplatedEmail.mockResolvedValue({ success: true });
  verifyOtp.mockResolvedValue({ data: { user: { id: "auth-1" } }, error: null });
  updateUser.mockResolvedValue({ error: null });
});

describe("normalizeEmail", () => {
  // Casing must not buy extra attempts against the per-email limit.
  it("lowercases and trims so one mailbox is one key", () => {
    expect(normalizeEmail("  Ada@Example.COM ")).toBe("ada@example.com");
  });
});

/** Runs the deferred half too, for the assertions that are about the mail. */
async function prepareAndDeliver(...args: Parameters<typeof preparePasswordReset>) {
  const outcome = await preparePasswordReset(...args);
  if (outcome.status === "ready") await outcome.deliver();
  return outcome;
}

describe("preparePasswordReset", () => {
  it("mails a link built from the minted token", async () => {
    await prepareAndDeliver(supabase, EMAIL, "1.2.3.4");

    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
    const [, params, to] = sendTemplatedEmail.mock.calls[0];
    expect(params.resetUrl).toContain(`/reset-password?token=${TOKEN}`);
    expect(params.name).toBe("Ada");
    expect(to.email).toBe(EMAIL);
  });

  // The lookup is what the caller waits on; the SMTP session is not. Resolving
  // before anything is sent is what keeps the reply off the mail server's clock.
  it("resolves ready without having sent anything yet", async () => {
    const outcome = await preparePasswordReset(supabase, EMAIL, "1.2.3.4");

    expect(outcome.status).toBe("ready");
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("records the attempt before deciding, so a race cannot slip two through", async () => {
    await preparePasswordReset(supabase, EMAIL, "1.2.3.4");

    expect(recordAttempt).toHaveBeenCalledWith(supabase, EMAIL, "1.2.3.4");
    expect(recordAttempt.mock.invocationCallOrder[0]).toBeLessThan(countByEmail.mock.invocationCallOrder[0]);
  });

  it("normalizes the address before it is counted or mailed", async () => {
    await prepareAndDeliver(supabase, "  ADA@Example.com ", null);

    expect(recordAttempt).toHaveBeenCalledWith(supabase, EMAIL, null);
    expect(generateLink).toHaveBeenCalledWith({ type: "recovery", email: EMAIL });
  });

  it("reports an address with no account, and sends nothing", async () => {
    generateLink.mockResolvedValue({ data: null, error: { status: 404, message: "User not found" } });

    const outcome = await prepareAndDeliver(supabase, EMAIL, "1.2.3.4");

    expect(outcome.status).toBe("unknown_email");
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  // An outage must not be reported as "no such account", or Supabase going down
  // would tell every visitor in turn that they are not registered.
  it("separates a backend failure from an unknown address", async () => {
    generateLink.mockResolvedValue({ data: null, error: { status: 503, message: "service unavailable" } });

    const outcome = await prepareAndDeliver(supabase, EMAIL, "1.2.3.4");

    expect(outcome.status).toBe("failed");
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("treats a link that came back without a token as a failure, not a missing account", async () => {
    generateLink.mockResolvedValue({ data: { user: {}, properties: {} }, error: null });

    const outcome = await prepareAndDeliver(supabase, EMAIL, "1.2.3.4");

    expect(outcome.status).toBe("failed");
  });

  it("swallows a send failure, which happens after the caller has been answered", async () => {
    sendTemplatedEmail.mockRejectedValue(new Error("smtp down"));

    await expect(prepareAndDeliver(supabase, EMAIL, "1.2.3.4")).resolves.toEqual(expect.objectContaining({ status: "ready" }));
  });

  // Refused before the lookup runs: the limit has to throttle the question, not
  // just the mail, now that the answer is visible to whoever asks.
  it("refuses past the per-email limit without looking the address up", async () => {
    countByEmail.mockResolvedValue(RESET_MAX_PER_EMAIL + 1);

    const outcome = await prepareAndDeliver(supabase, EMAIL, "1.2.3.4");

    expect(outcome.status).toBe("rate_limited");
    expect(generateLink).not.toHaveBeenCalled();
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("still mails on the last attempt inside the limit", async () => {
    countByEmail.mockResolvedValue(RESET_MAX_PER_EMAIL);

    await prepareAndDeliver(supabase, EMAIL, "1.2.3.4");

    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
  });

  it("refuses past the per-IP limit without looking the address up", async () => {
    countByIp.mockResolvedValue(RESET_MAX_PER_IP + 1);

    const outcome = await prepareAndDeliver(supabase, EMAIL, "1.2.3.4");

    expect(outcome.status).toBe("rate_limited");
    expect(generateLink).not.toHaveBeenCalled();
  });

  // `next dev` has no CF-Connecting-IP, and the per-email limit has to hold
  // there on its own rather than the request going uncounted.
  it("applies the email limit when there is no IP to key on", async () => {
    await prepareAndDeliver(supabase, EMAIL, null);

    expect(countByIp).not.toHaveBeenCalled();
    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
  });

  it("falls back to a neutral greeting when the account has no name", async () => {
    generateLink.mockResolvedValue({ data: { user: { user_metadata: {} }, properties: { hashed_token: TOKEN } }, error: null });

    await prepareAndDeliver(supabase, EMAIL, null);

    expect(sendTemplatedEmail.mock.calls[0][1].name).toBe("there");
  });
});

describe("confirmPasswordReset", () => {
  it("spends the token and sets the password", async () => {
    const result = await confirmPasswordReset(supabase, TOKEN, "a-long-enough-password");

    expect(verifyOtp).toHaveBeenCalledWith({ type: "recovery", token_hash: TOKEN });
    expect(updateUser).toHaveBeenCalledWith({ password: "a-long-enough-password" });
    expect(result).toEqual({ ok: true, authUserId: "auth-1" });
  });

  // Checked first so a too-short password does not burn the single-use token.
  it("rejects a short password without spending the token", async () => {
    const result = await confirmPasswordReset(supabase, TOKEN, "x".repeat(MIN_PASSWORD_LENGTH - 1));

    expect(result).toEqual({ ok: false, reason: "weak_password" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  // The rule needing an identity can only run once the token is verified, and
  // verifying is what spends it — so this refusal cannot offer a retry.
  it("refuses a password built from the account's own name, without setting it", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: { id: "auth-1", email: "ada.lovelace@example.com", user_metadata: { full_name: "Ada Lovelace" } } },
      error: null,
    });

    const result = await confirmPasswordReset(supabase, TOKEN, "adalovelace2026");

    expect(result).toEqual({ ok: false, reason: "personal_password" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("applies the identity rule against the email as well as the name", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: { id: "auth-1", email: "kettlewright@example.com", user_metadata: {} } },
      error: null,
    });

    const result = await confirmPasswordReset(supabase, TOKEN, "kettlewright tea");

    expect(result).toEqual({ ok: false, reason: "personal_password" });
  });

  it("still sets a password that has nothing to do with the account", async () => {
    verifyOtp.mockResolvedValue({
      data: { user: { id: "auth-1", email: "ada.lovelace@example.com", user_metadata: { full_name: "Ada Lovelace" } } },
      error: null,
    });

    const result = await confirmPasswordReset(supabase, TOKEN, "the quiet kettle sings");

    expect(result).toEqual({ ok: true, authUserId: "auth-1" });
    expect(updateUser).toHaveBeenCalledWith({ password: "the quiet kettle sings" });
  });

  // Judged before verifying, so the link survives for another attempt.
  it("refuses a common password without spending the token", async () => {
    const result = await confirmPasswordReset(supabase, TOKEN, "password1234");

    expect(result).toEqual({ ok: false, reason: "weak_password" });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("copes with an account carrying no name at all", async () => {
    verifyOtp.mockResolvedValue({ data: { user: { id: "auth-1", email: "ada@example.com" } }, error: null });

    const result = await confirmPasswordReset(supabase, TOKEN, "the quiet kettle sings");

    expect(result).toEqual({ ok: true, authUserId: "auth-1" });
  });

  it("reports an invalid token without touching the password", async () => {
    verifyOtp.mockResolvedValue({ data: { user: null }, error: { message: "expired" } });

    const result = await confirmPasswordReset(supabase, TOKEN, "a-long-enough-password");

    expect(result).toEqual({ ok: false, reason: "invalid_token" });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("reports failure when the update itself is refused", async () => {
    updateUser.mockResolvedValue({ error: { message: "weak" } });

    const result = await confirmPasswordReset(supabase, TOKEN, "a-long-enough-password");

    expect(result).toEqual({ ok: false, reason: "invalid_token" });
  });
});
