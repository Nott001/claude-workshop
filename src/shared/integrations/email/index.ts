import type { EmailProvider } from "./types";
import { ConsoleEmailProvider } from "./providers/console";
import { SmtpEmailProvider } from "./providers/smtp";
import { readSmtpConfig } from "./providers/smtp/config";
import { isWorkerdRuntime } from "./providers/smtp/socket";

let instance: EmailProvider | null = null;

/**
 * SMTP needs both a configured mailbox and the Workers runtime that can open
 * the socket, so `next dev` keeps logging to the console even with credentials
 * present. Use `pnpm cf:preview` to exercise real delivery.
 */
export function createDefaultProvider(): EmailProvider {
  const config = readSmtpConfig();
  return config && isWorkerdRuntime() ? new SmtpEmailProvider(config) : new ConsoleEmailProvider();
}

export function configureEmailService(provider: EmailProvider): void {
  instance = provider;
}

/** Resolved on first use, not at module load, so the Worker env is populated. */
export function getEmailService(): EmailProvider {
  instance ??= createDefaultProvider();
  return instance;
}

export function resetEmailService(): void {
  instance = null;
}
