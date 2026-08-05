import type { EmailProvider, SendEmailParams } from "../../types";
import type { SmtpConfig } from "./config";
import type { SmtpDuplex } from "./session";
import { buildMimeMessage } from "./mime";
import { runSmtpSession, SmtpError } from "./session";
import { connectSmtp, withTimeout } from "./socket";

type Connect = (hostname: string, port: number) => Promise<SmtpDuplex>;

/** 4xx is the server saying "not now"; 5xx is "never", and retrying it is rude. */
function isRetryable(error: unknown): boolean {
  if (error instanceof SmtpError) return error.reply.code >= 400 && error.reply.code < 500;
  // A timeout or a dropped socket carries no reply code and is exactly the
  // transient case worth a second attempt.
  return true;
}

/**
 * Speaks SMTP directly instead of through a library: nodemailer needs the full
 * node:tls surface, which workerd only partially implements, so it cannot run
 * on the deploy target. The connection is injectable so tests never open one.
 */
export class SmtpEmailProvider implements EmailProvider {
  constructor(
    private readonly config: SmtpConfig,
    private readonly connect: Connect = connectSmtp,
  ) {}

  async send(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
    const from = { email: this.config.fromEmail, name: this.config.fromName };

    // Built once and reused across attempts so a retry re-sends the same
    // message rather than a fresh one with a new Message-ID.
    const message = buildMimeMessage({
      from,
      to: params.to,
      subject: params.subject,
      html: params.htmlContent,
      text: params.textContent,
      replyTo: this.config.replyTo,
    });

    let lastError = "";

    for (let attempt = 1; attempt <= this.config.attempts; attempt++) {
      const startedAt = Date.now();
      try {
        await this.deliver(message, params.to.email, from.email);
        console.log(`[smtp] delivered to ${params.to.email} in ${Date.now() - startedAt}ms (attempt ${attempt})`);
        return { success: true };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        console.warn(`[smtp] attempt ${attempt} failed after ${Date.now() - startedAt}ms: ${lastError}`);

        if (attempt === this.config.attempts || !isRetryable(error)) break;
      }
    }

    // Returned rather than thrown: the caller records a `failed` EMAIL_LOG row
    // and registration must not fail because delivery did.
    return { success: false, error: lastError };
  }

  private async deliver(message: string, to: string, from: string): Promise<void> {
    const connection = await this.connect(this.config.host, this.config.port);

    await withTimeout(
      runSmtpSession(connection, {
        // Identifying as the sending domain is what receiving MTAs expect.
        ehloName: from.split("@")[1] ?? "localhost",
        username: this.config.username,
        password: this.config.password,
        envelopeFrom: from,
        envelopeTo: to,
        message,
      }),
      this.config.timeoutMs,
      "SMTP session",
    );
  }
}
