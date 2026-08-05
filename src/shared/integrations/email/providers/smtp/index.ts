import type { EmailProvider, SendEmailParams } from "../../types";
import type { SmtpConfig } from "./config";
import type { SmtpDuplex } from "./session";
import { buildMimeMessage } from "./mime";
import { runSmtpSession } from "./session";
import { connectSmtp, withTimeout } from "./socket";

type Connect = (hostname: string, port: number) => Promise<SmtpDuplex>;

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

    const message = buildMimeMessage({
      from,
      to: params.to,
      subject: params.subject,
      html: params.htmlContent,
    });

    try {
      const connection = await this.connect(this.config.host, this.config.port);

      await withTimeout(
        runSmtpSession(connection, {
          // Identifying as the sending domain is what receiving MTAs expect.
          ehloName: from.email.split("@")[1] ?? "localhost",
          username: this.config.username,
          password: this.config.password,
          envelopeFrom: from.email,
          envelopeTo: params.to.email,
          message,
        }),
        this.config.timeoutMs,
        "SMTP session",
      );

      return { success: true };
    } catch (error) {
      // Returned rather than thrown: the caller records a `failed` EMAIL_LOG row
      // and registration must not fail because delivery did.
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
}
