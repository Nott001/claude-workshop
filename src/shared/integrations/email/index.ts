import type { EmailProvider, SendEmailParams } from "./types";
import { emailTemplates } from "./templates";

export type { EmailProvider, SendEmailParams };
export { emailTemplates };

export class EmailService {
  constructor(private provider: EmailProvider) {}

  async send(params: SendEmailParams): Promise<{ success: boolean }> {
    return this.provider.send(params);
  }
}

let instance: EmailService | null = null;

export function configureEmailService(provider: EmailProvider): void {
  instance = new EmailService(provider);
}

export function getEmailService(): EmailService {
  if (!instance) {
    throw new Error("EmailService not configured — call configureEmailService(provider) in layout.tsx");
  }
  return instance;
}
