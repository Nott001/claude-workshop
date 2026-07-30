import { describe, it, expect, afterEach } from "vitest";
import { ConsoleEmailProvider } from "@/shared/integrations/email/providers/console";
import { getEmailService, configureEmailService } from "@/shared/integrations/email";
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

describe("EmailService singleton", () => {
  afterEach(() => {
    configureEmailService(new ConsoleEmailProvider());
  });

  it("auto-initializes with ConsoleEmailProvider", () => {
    const service = getEmailService();
    expect(service).toBeInstanceOf(ConsoleEmailProvider);
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
});
