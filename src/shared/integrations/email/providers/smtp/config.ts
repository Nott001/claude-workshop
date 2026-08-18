export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  fromEmail: string;
  fromName: string;
  replyTo?: string;
  timeoutMs: number;
  attempts: number;
}

const DEFAULT_PORT = 465;

// A normal send against the live host takes ~4.5s, but the greeting sometimes
// stalls well past that. The reset route awaits its send, so this bound is what
// keeps a dead relay from holding a request open for minutes; the retry below
// then gives a second connection to a stall a second chance.
const DEFAULT_TIMEOUT_MS = 30_000;

// One retry. The observed failure was a greeting that never arrived on an
// otherwise healthy server, which a second connection clears; anything the
// server actively rejects will be rejected again, so a third try buys nothing.
const DEFAULT_ATTEMPTS = 2;

function positiveInt(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

/** A loopback host can only be a local capture box (inbucket); nothing real is relayed there. */
export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

/** Explicit off/on wins; otherwise the security mode follows the host. */
function parseSecure(raw: string | undefined, host: string): boolean {
  if (raw === "off" || raw === "false" || raw === "0") return false;
  if (raw === "on" || raw === "true" || raw === "1") return true;
  return !isLoopbackHost(host);
}

/**
 * Returns null when the mailbox is not configured rather than throwing, so an
 * unset password degrades to the console provider instead of failing every
 * registration. Never name any of these `NEXT_PUBLIC_*`: the Next compiler
 * inlines those into the client bundle, which would publish the password.
 */
export function readSmtpConfig(env: Record<string, string | undefined> = process.env): SmtpConfig | null {
  const host = env.SMTP_HOST?.trim();
  const username = env.SMTP_USER?.trim();
  const password = env.SMTP_PASSWORD;

  if (!host || !username || !password) return null;

  return {
    host,
    port: positiveInt(env.SMTP_PORT, DEFAULT_PORT),
    // A local capture box speaks plaintext and gets it with no extra setting;
    // a remote relay defaults to implicit TLS so a password is never sent
    // unencrypted to a real host by accident. SMTP_SECURE overrides both.
    secure: parseSecure(env.SMTP_SECURE, host),
    username,
    password,
    // cPanel rejects a MAIL FROM the authenticated account does not own, so the
    // envelope sender defaults to the mailbox rather than to a display address.
    fromEmail: env.SMTP_FROM_EMAIL?.trim() || username,
    fromName: env.SMTP_FROM_NAME?.trim() || "Startup Lab",
    // Omitted rather than defaulted to the no-reply mailbox: a Reply-To nobody
    // reads is worse than none at all.
    replyTo: env.SMTP_REPLY_TO?.trim() || undefined,
    timeoutMs: positiveInt(env.SMTP_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    attempts: positiveInt(env.SMTP_ATTEMPTS, DEFAULT_ATTEMPTS),
  };
}
