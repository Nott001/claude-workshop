import type { EmailProvider } from "./types";
import { ConsoleEmailProvider } from "./providers/console";
import { UnconfiguredEmailProvider } from "./providers/unconfigured";
import { SmtpEmailProvider } from "./providers/smtp";
import { readSmtpConfig } from "./providers/smtp/config";
import { isWorkerdRuntime } from "./providers/smtp/socket";

let instance: EmailProvider | null = null;

/**
 * SMTP needs both a configured mailbox and the Workers runtime that can open
 * the socket, so `next dev` keeps logging to the console even with credentials
 * present. Use `pnpm cf:preview` to exercise real delivery.
 *
 * Missing credentials mean opposite things on the two runtimes, so they get
 * opposite answers: off workerd there is no socket either way and logging is
 * expected, while on workerd it is a deployment that forgot its secrets and
 * must not be allowed to report delivery it never attempted.
 */
export function createDefaultProvider(): EmailProvider {
  if (!isWorkerdRuntime()) return new ConsoleEmailProvider();

  const config = readSmtpConfig();
  return config ? new SmtpEmailProvider(config) : new UnconfiguredEmailProvider();
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
