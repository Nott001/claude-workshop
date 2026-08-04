export interface SendEmailParams {
  to: { email: string; name: string };
  subject: string;
  htmlContent: string;
  /** Written by the template. Derived from the HTML when absent. */
  textContent?: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<{ success: boolean; error?: string }>;
}
