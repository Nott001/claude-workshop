import { describe, it, expect, afterEach } from "vitest";
import { ConsoleEmailProvider } from "@/shared/integrations/email/providers/console";
import { getEmailService, configureEmailService, createDefaultProvider, resetEmailService } from "@/shared/integrations/email";
import type { EmailProvider } from "@/shared/integrations/email/types";

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

describe("createDefaultProvider", () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
    resetEmailService();
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
