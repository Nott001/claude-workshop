import type { EmailProvider } from "./types";
import { ConsoleEmailProvider } from "./providers/console";
import { UnconfiguredEmailProvider } from "./providers/unconfigured";
import { SmtpEmailProvider } from "./providers/smtp";
import { isLoopbackHost, readSmtpConfig } from "./providers/smtp/config";
import { isWorkerdRuntime } from "./providers/smtp/socket";
import { connectSmtpNode } from "./providers/smtp/node-socket";

let instance: EmailProvider | null = null;

/**
 * The Worker opens the cloudflare:sockets connection for whatever host is
 * configured. `next dev` has no such socket, so it only dials a local capture
 * box — a loopback guard is what keeps dev credentials from ever reaching a
 * real relay by accident. With no capture box configured, dev keeps logging to
 * the console and a worker that forgot its secrets must not report delivery it
 * never attempted.
 */
export function createDefaultProvider(): EmailProvider {
  const config = readSmtpConfig();

  if (config && isWorkerdRuntime()) return new SmtpEmailProvider(config);
  if (config && isLoopbackHost(config.host)) return new SmtpEmailProvider(config, connectSmtpNode);

  return isWorkerdRuntime() ? new UnconfiguredEmailProvider() : new ConsoleEmailProvider();
}

/**
 * True only for the dev fallback that logs instead of sending. The reset route
 * reads it to decide whether handing the minted URL back to the browser could
 * ever be a thing worth doing.
 */
export function emailDeliveryIsLocal(): boolean {
  return getEmailService() instanceof ConsoleEmailProvider;
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
