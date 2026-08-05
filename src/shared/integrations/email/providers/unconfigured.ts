import type { EmailProvider, SendEmailParams } from "../types";

const MISSING = "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD with `wrangler secret put`.";

/**
 * Stands in on workerd when no mailbox is configured.
 *
 * The console provider is the right answer under `next dev`, where nobody
 * expects delivery. On the Workers runtime the credentials were meant to be
 * there, so reporting success writes `sent` to EMAIL_LOG and tells an
 * administrator an invitation went out that never left the isolate — which is
 * how three unset secrets went unnoticed in production for weeks. Refusing is
 * the honest answer, and it is the one the callers already handle.
 */
export class UnconfiguredEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
    console.error(`[email] not sent to ${params.to.email}: ${MISSING}`);
    return { success: false, error: MISSING };
  }
}
