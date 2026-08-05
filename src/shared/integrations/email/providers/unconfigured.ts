import type { EmailProvider, SendEmailParams } from "../types";

const MISSING = "SMTP is not configured. Set SMTP_HOST, SMTP_USER and SMTP_PASSWORD with `wrangler secret put`.";

/** Stands in on workerd when no mailbox is configured. See ../index.ts. */
export class UnconfiguredEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
    console.error(`[email] not sent to ${params.to.email}: ${MISSING}`);
    return { success: false, error: MISSING };
  }
}
