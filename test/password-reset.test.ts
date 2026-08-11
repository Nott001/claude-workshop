import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import {
  requestPasswordReset,
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

describe("requestPasswordReset", () => {
  it("mails a link built from the minted token", async () => {
    await requestPasswordReset(supabase, EMAIL, "1.2.3.4");

    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
    const [, params, to] = sendTemplatedEmail.mock.calls[0];
    expect(params.resetUrl).toContain(`/reset-password?token=${TOKEN}`);
    expect(params.name).toBe("Ada");
    expect(to.email).toBe(EMAIL);
  });

  it("records the attempt before deciding, so a race cannot slip two through", async () => {
    await requestPasswordReset(supabase, EMAIL, "1.2.3.4");

    expect(recordAttempt).toHaveBeenCalledWith(supabase, EMAIL, "1.2.3.4");
    expect(recordAttempt.mock.invocationCallOrder[0]).toBeLessThan(countByEmail.mock.invocationCallOrder[0]);
  });

  it("normalizes the address before it is counted or mailed", async () => {
    await requestPasswordReset(supabase, "  ADA@Example.com ", null);

    expect(recordAttempt).toHaveBeenCalledWith(supabase, EMAIL, null);
    expect(generateLink).toHaveBeenCalledWith({ type: "recovery", email: EMAIL });
  });

  // The whole point of the endpoint returning void: an unknown address must be
  // indistinguishable from a known one.
  it("stays silent and sends nothing for an address with no account", async () => {
    generateLink.mockResolvedValue({ data: null, error: { message: "User not found" } });

    await expect(requestPasswordReset(supabase, EMAIL, "1.2.3.4")).resolves.toBeUndefined();
    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  it("swallows a send failure rather than turning it into a distinguishing error", async () => {
    sendTemplatedEmail.mockRejectedValue(new Error("smtp down"));

    await expect(requestPasswordReset(supabase, EMAIL, "1.2.3.4")).resolves.toBeUndefined();
  });

  it("stops mailing once the per-email limit is passed", async () => {
    countByEmail.mockResolvedValue(RESET_MAX_PER_EMAIL + 1);

    await requestPasswordReset(supabase, EMAIL, "1.2.3.4");

    expect(sendTemplatedEmail).not.toHaveBeenCalled();
    expect(generateLink).not.toHaveBeenCalled();
  });

  it("still mails on the last attempt inside the limit", async () => {
    countByEmail.mockResolvedValue(RESET_MAX_PER_EMAIL);

    await requestPasswordReset(supabase, EMAIL, "1.2.3.4");

    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
  });

  it("stops mailing once one origin passes the per-IP limit", async () => {
    countByIp.mockResolvedValue(RESET_MAX_PER_IP + 1);

    await requestPasswordReset(supabase, EMAIL, "1.2.3.4");

    expect(sendTemplatedEmail).not.toHaveBeenCalled();
  });

  // `next dev` has no CF-Connecting-IP, and the per-email limit has to hold
  // there on its own rather than the request going uncounted.
  it("applies the email limit when there is no IP to key on", async () => {
    await requestPasswordReset(supabase, EMAIL, null);

    expect(countByIp).not.toHaveBeenCalled();
    expect(sendTemplatedEmail).toHaveBeenCalledTimes(1);
  });

  it("falls back to a neutral greeting when the account has no name", async () => {
    generateLink.mockResolvedValue({ data: { user: { user_metadata: {} }, properties: { hashed_token: TOKEN } }, error: null });

    await requestPasswordReset(supabase, EMAIL, null);

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
