export interface SendEmailParams {
  to: { email: string; name: string };
  subject: string;
  htmlContent: string;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<{ success: boolean; error?: string }>;
}
