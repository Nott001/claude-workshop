import { describe, it, expect } from "vitest";
import { readSmtpConfig } from "@/shared/integrations/email/providers/smtp/config";

const COMPLETE = {
  SMTP_HOST: "mail.startuplab.center",
  SMTP_USER: "no-reply@startuplab.center",
  SMTP_PASSWORD: "s3cret",
};

describe("readSmtpConfig", () => {
  it("reads a complete mailbox definition", () => {
    expect(readSmtpConfig(COMPLETE)).toMatchObject({
      host: "mail.startuplab.center",
      username: "no-reply@startuplab.center",
      password: "s3cret",
    });
  });

  it.each(["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"])("returns null without %s", (key) => {
    expect(readSmtpConfig({ ...COMPLETE, [key]: undefined })).toBeNull();
  });

  it("returns null for an empty environment", () => {
    expect(readSmtpConfig({})).toBeNull();
  });

  it("treats a blank host or user as unset", () => {
    expect(readSmtpConfig({ ...COMPLETE, SMTP_HOST: "   " })).toBeNull();
    expect(readSmtpConfig({ ...COMPLETE, SMTP_USER: "" })).toBeNull();
  });

  it("defaults to implicit-TLS SMTP with a bounded timeout", () => {
    expect(readSmtpConfig(COMPLETE)).toMatchObject({ port: 465, timeoutMs: 15_000 });
  });

  it("sends from the authenticated mailbox unless told otherwise", () => {
    expect(readSmtpConfig(COMPLETE)?.fromEmail).toBe("no-reply@startuplab.center");
    expect(readSmtpConfig({ ...COMPLETE, SMTP_FROM_EMAIL: "tickets@startuplab.center" })?.fromEmail).toBe(
      "tickets@startuplab.center",
    );
  });

  it("carries a default display name that overrides cleanly", () => {
    expect(readSmtpConfig(COMPLETE)?.fromName).toBe("Startup Lab");
    expect(readSmtpConfig({ ...COMPLETE, SMTP_FROM_NAME: "SL Events" })?.fromName).toBe("SL Events");
  });

  it("honours explicit port and timeout overrides", () => {
    expect(readSmtpConfig({ ...COMPLETE, SMTP_PORT: "2525", SMTP_TIMEOUT_MS: "5000" })).toMatchObject({
      port: 2525,
      timeoutMs: 5000,
    });
  });

  it.each(["not-a-number", "0", "-1", "465.5", ""])("ignores the unusable port %j", (port) => {
    expect(readSmtpConfig({ ...COMPLETE, SMTP_PORT: port })?.port).toBe(465);
  });

  it("keeps a password containing shell-significant characters intact", () => {
    // `#` starts a comment and `$` interpolates in a dotenv file, so the real
    // value must be single-quoted in `.dev.vars` and must survive unmangled.
    const awkward = "a1-@!#$bcd2+%Ef3";
    expect(readSmtpConfig({ ...COMPLETE, SMTP_PASSWORD: awkward })?.password).toBe(awkward);
  });
});
