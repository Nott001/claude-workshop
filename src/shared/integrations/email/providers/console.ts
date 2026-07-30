import type { EmailProvider, SendEmailParams } from "../types";

export class ConsoleEmailProvider implements EmailProvider {
  async send(params: SendEmailParams): Promise<{ success: boolean }> {
    console.log("[Email] To:", params.to.email);
    console.log("[Email] Subject:", params.subject);
    console.log("[Email] HTML:", params.htmlContent);
    return { success: true };
  }
}
