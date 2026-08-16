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
 * configured. `next dev` has no such socket, so it only ever dials a local
 * capture box — a loopback guard is what keeps dev credentials from ever
 * reaching a real relay by accident. When the app targets the local Supabase
 * stack it routes to the same capture box GoTrue's own mail already lands in,
 * so app-sent mail (resets, invites, tickets) needs no per-developer SMTP
 * config. A worker that forgot its secrets must not report delivery it never
 * attempted.
 */
export function createDefaultProvider(): EmailProvider {
  const config = readSmtpConfig();

  if (config && isWorkerdRuntime()) return new SmtpEmailProvider(config);
  if (config && isLoopbackHost(config.host)) return new SmtpEmailProvider(config, connectSmtpNode);

  if (!isWorkerdRuntime() && pointsAtLocalStack()) {
    return new SmtpEmailProvider(devCaptureBoxConfig(), connectSmtpNode);
  }

  return isWorkerdRuntime() ? new UnconfiguredEmailProvider() : new ConsoleEmailProvider();
}

/**
 * True when the app is pointed at the local Supabase stack (`pnpm db:env
 * local` writes this URL). It is the signal that a capture box exists, because
 * `supabase/config.toml` routes all of GoTrue's auth mail there.
 */
function pointsAtLocalStack(): boolean {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!raw) return false;
  try {
    return isLoopbackHost(new URL(raw).hostname);
  } catch {
    return false;
  }
}

/**
 * The cap: 54325 is inbucket's host-published SMTP port (GoTrue reaches it by
 * its docker-network alias on 1025). Parsed through `readSmtpConfig` so a
 * loopback host gets plaintext without having to restate the rule.
 */
function devCaptureBoxConfig() {
  return readSmtpConfig({
    SMTP_HOST: "127.0.0.1",
    SMTP_PORT: "54325",
    SMTP_USER: "inbucket",
    SMTP_PASSWORD: "inbucket",
  })!;
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
