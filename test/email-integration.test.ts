import { describe, it, expect, afterEach, vi } from "vitest";
import { ConsoleEmailProvider } from "@/shared/integrations/email/providers/console";
import { UnconfiguredEmailProvider } from "@/shared/integrations/email/providers/unconfigured";
import { SmtpEmailProvider } from "@/shared/integrations/email/providers/smtp";
import { getEmailService, configureEmailService, createDefaultProvider, resetEmailService } from "@/shared/integrations/email";
import type { EmailProvider } from "@/shared/integrations/email/types";
import { sendTemplatedEmail } from "@/shared/integrations/email/send-templated";
import { memberInvitedTemplate } from "@/shared/integrations/email/templates";

/** workerd is identified by its user agent; vitest runs on Node, which is not. */
function pretendWorkerd() {
  vi.stubGlobal("navigator", { userAgent: "Cloudflare-Workers" });
}

describe("ConsoleEmailProvider", () => {
  it("logs and returns success", async () => {
    const provider = new ConsoleEmailProvider();
    const result = await provider.send({
      to: { email: "a@b.com", name: "A" },
      subject: "S",
      htmlContent: "<p>c</p>",
    });
    expect(result.success).toBe(true);
  });

  it("returns success with optional error field", async () => {
    const provider = new ConsoleEmailProvider();
    const result = await provider.send({
      to: { email: "x@y.com", name: "X" },
      subject: "T",
      htmlContent: "<p>d</p>",
    });
    expect(result).toHaveProperty("success");
    expect(result).not.toHaveProperty("error");
  });
});

describe("UnconfiguredEmailProvider", () => {
  it("refuses the send and says which secrets are missing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await new UnconfiguredEmailProvider().send({
      to: { email: "invitee@example.com", name: "Invitee" },
      subject: "S",
      htmlContent: "<p>c</p>",
    });

    // The invite route deletes the half-created account on `!success`, so this
    // is the difference between a retryable failure and an admin being told an
    // invitation went out that never left the isolate.
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/SMTP_HOST/);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe("createDefaultProvider", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    vi.unstubAllGlobals();
    resetEmailService();
  });

  it("refuses to send on workerd when no mailbox is configured", () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    pretendWorkerd();

    // Production forgetting `wrangler secret put` must not degrade to a
    // provider that reports success.
    expect(createDefaultProvider()).toBeInstanceOf(UnconfiguredEmailProvider);
  });

  it("speaks SMTP on workerd once the mailbox is configured", () => {
    process.env.SMTP_HOST = "mail.startuplab.center";
    process.env.SMTP_USER = "no-reply@startuplab.center";
    process.env.SMTP_PASSWORD = "s3cret";
    pretendWorkerd();

    expect(createDefaultProvider()).toBeInstanceOf(SmtpEmailProvider);
  });

  it("logs to the console when no mailbox is configured", () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    expect(createDefaultProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("still logs off-workerd even with credentials, since no socket exists", () => {
    // vitest runs on Node, which is exactly the `next dev` situation: the
    // credentials are present but `cloudflare:sockets` is not.
    process.env.SMTP_HOST = "mail.startuplab.center";
    process.env.SMTP_USER = "no-reply@startuplab.center";
    process.env.SMTP_PASSWORD = "s3cret";

    expect(createDefaultProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });
});

describe("EmailService singleton", () => {
  afterEach(() => {
    configureEmailService(new ConsoleEmailProvider());
  });

  it("auto-initializes with ConsoleEmailProvider", () => {
    resetEmailService();
    expect(getEmailService()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("resolves the provider once and reuses it", () => {
    resetEmailService();
    expect(getEmailService()).toBe(getEmailService());
  });

  it("configureEmailService overrides the provider", () => {
    const mock: EmailProvider = {
      send: async () => ({ success: true }),
    };
    configureEmailService(mock);
    expect(getEmailService()).toBe(mock);
  });

  it("returns new provider after reconfigure", () => {
    const mockA: EmailProvider = {
      send: async () => ({ success: false, error: "err" }),
    };
    configureEmailService(mockA);
    expect(getEmailService()).toBe(mockA);

    const mockB: EmailProvider = {
      send: async () => ({ success: true }),
    };
    configureEmailService(mockB);
    expect(getEmailService()).toBe(mockB);
  });

  it("falls back to the default again after a reset", () => {
    configureEmailService({ send: async () => ({ success: true }) });
    resetEmailService();
    expect(getEmailService()).toBeInstanceOf(ConsoleEmailProvider);
  });
});

describe("sendTemplatedEmail", () => {
  afterEach(() => {
    resetEmailService();
  });

  function recordingProvider(result: { success: boolean; error?: string } = { success: true }) {
    const send = vi.fn().mockResolvedValue(result);
    configureEmailService({ send });
    return send;
  }

  it("composes both parts from the template and addresses the recipient", async () => {
    const send = recordingProvider();

    await sendTemplatedEmail(
      memberInvitedTemplate,
      { name: "Ada", role: "admin", acceptUrl: "https://startuplab.center/invite?token=abc" },
      { email: "ada@example.com", name: "Ada" },
    );

    expect(send).toHaveBeenCalledTimes(1);
    const sent = send.mock.calls[0][0];
    expect(sent.to).toEqual({ email: "ada@example.com", name: "Ada" });
    expect(sent.subject).toBe(memberInvitedTemplate.subject);
    expect(sent.htmlContent).toContain("Ada");
    expect(sent.htmlContent).toContain("https://startuplab.center/invite?token=abc");
    // The text part is written, not derived, so it has to arrive populated.
    expect(sent.textContent).toContain("Ada");
    expect(sent.textContent).not.toContain("<");
  });

  // The invite route deletes the half-created account on `!success`, so a
  // swallowed provider failure would strand an account nobody can re-invite.
  it("passes the provider's failure back to the caller", async () => {
    recordingProvider({ success: false, error: "550 mailbox unavailable" });

    const result = await sendTemplatedEmail(
      memberInvitedTemplate,
      { name: "Ada", role: "admin", acceptUrl: "https://startuplab.center/invite?token=abc" },
      { email: "ada@example.com", name: "Ada" },
    );

    expect(result.success).toBe(false);
    expect(result.error).toBe("550 mailbox unavailable");
  });
});
