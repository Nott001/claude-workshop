import { describe, it, expect, afterEach, vi } from "vitest";
import { ConsoleEmailProvider } from "@/shared/integrations/email/providers/console";
import { UnconfiguredEmailProvider } from "@/shared/integrations/email/providers/unconfigured";
import { SmtpEmailProvider } from "@/shared/integrations/email/providers/smtp";
import {
  getEmailService,
  configureEmailService,
  createDefaultProvider,
  devCaptureBoxConfig,
  emailDeliveryIsLocal,
  resetEmailService,
} from "@/shared/integrations/email";
import { readSmtpConfig } from "@/shared/integrations/email/providers/smtp/config";
import type { EmailProvider } from "@/shared/integrations/email/types";
import { sendTemplatedEmail } from "@/shared/integrations/email/send-templated";
import { memberInvitedTemplate } from "@/shared/integrations/email/templates";

const COMPLETE = {
  SMTP_HOST: "mail.startuplab.center",
  SMTP_USER: "no-reply@startuplab.center",
  SMTP_PASSWORD: "s3cret",
};

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
    process.env.SMTP_HOST = COMPLETE.SMTP_HOST;
    process.env.SMTP_USER = COMPLETE.SMTP_USER;
    process.env.SMTP_PASSWORD = COMPLETE.SMTP_PASSWORD;
    pretendWorkerd();

    expect(createDefaultProvider()).toBeInstanceOf(SmtpEmailProvider);
  });

  it("logs to the console when no mailbox is configured", () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;

    expect(createDefaultProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  // A remote host off workerd must not be dialled from a dev machine: the
  // credentials would mail a real relay. Only a loopback capture box is SMTP'd.
  it("keeps logging off-workerd when the configured host is remote", () => {
    process.env.SMTP_HOST = COMPLETE.SMTP_HOST;
    process.env.SMTP_USER = COMPLETE.SMTP_USER;
    process.env.SMTP_PASSWORD = COMPLETE.SMTP_PASSWORD;

    expect(createDefaultProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  it("routes local-stack dev mail to the capture box with no SMTP configured", () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

    expect(createDefaultProvider()).toBeInstanceOf(SmtpEmailProvider);
  });

  // The usual dev `.env` carries prod-ish SMTP for the workerd build. Node dev
  // must not mail that relay, but it should still reach inbucket — GoTrue's own
  // mail already does, because config.toml routes it there.
  it("routes local-stack dev mail to the capture box over a remote SMTP host", () => {
    process.env.SMTP_HOST = COMPLETE.SMTP_HOST;
    process.env.SMTP_USER = COMPLETE.SMTP_USER;
    process.env.SMTP_PASSWORD = COMPLETE.SMTP_PASSWORD;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";

    expect(createDefaultProvider()).toBeInstanceOf(SmtpEmailProvider);
  });

  it("keeps the console when dev targets the hosted project even with SMTP set", () => {
    process.env.SMTP_HOST = COMPLETE.SMTP_HOST;
    process.env.SMTP_USER = COMPLETE.SMTP_USER;
    process.env.SMTP_PASSWORD = COMPLETE.SMTP_PASSWORD;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://aiyernsxamtgjebheekp.supabase.co";

    expect(createDefaultProvider()).toBeInstanceOf(ConsoleEmailProvider);
  });

  // Mailpit rejects a MAIL FROM it cannot address: the username-derived
  // default "inbucket" is not a valid sender, which answered the capture box
  // with 553 5.1.3 for every dev reset.
  it("gives the dev capture box a real-shaped envelope sender", () => {
    const config = devCaptureBoxConfig();

    expect(config.host).toBe("127.0.0.1");
    expect(config.port).toBe(54325);
    expect(config.secure).toBe(false);
    expect(config.fromEmail).toMatch(/^[^@\s]+@[^@\s]+$/);
  });

  it("speaks SMTP in dev when the config points at a local capture box", () => {
    process.env.SMTP_HOST = "127.0.0.1";
    process.env.SMTP_PORT = "54325";
    process.env.SMTP_USER = "inbucket";
    process.env.SMTP_PASSWORD = "inbucket";

    expect(createDefaultProvider()).toBeInstanceOf(SmtpEmailProvider);
  });

  it("reports console delivery as local and SMTP delivery as not", () => {
    resetEmailService();
    expect(emailDeliveryIsLocal()).toBe(true);
    configureEmailService(new SmtpEmailProvider(readSmtpConfig(COMPLETE)!));
    expect(emailDeliveryIsLocal()).toBe(false);
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
