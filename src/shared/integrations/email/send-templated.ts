import { getEmailService } from "./index";

export interface EmailTemplate<P> {
  subject: string;
  buildHtml: (params: P) => string;
  buildText: (params: P) => string;
}

/**
 * Compose a template and hand the result to the configured provider.
 *
 * Writes no EMAIL_LOG row. `sendEmailNotification` wraps this for the types
 * that have a USER row to reference; the invitation path deliberately has none
 * yet, which is why it needs a send that does not log.
 */
export async function sendTemplatedEmail<P>(
  template: EmailTemplate<P>,
  params: P,
  to: { email: string; name: string },
): Promise<{ success: boolean; error?: string }> {
  return getEmailService().send({
    to,
    subject: template.subject,
    htmlContent: template.buildHtml(params),
    textContent: template.buildText(params),
  });
}
