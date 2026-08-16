export interface SendEmailParams {
  to: { email: string; name: string };
  subject: string;
  htmlContent: string;
  /** Written by the template. Derived from the HTML when absent. */
  textContent?: string;
  /**
   * Whether this message should offer an unsubscribe, if one is configured.
   *
   * Set by the template rather than the caller, because it is a property of the
   * message: mail the recipient asked for — a ticket they bought, a reset they
   * requested — must not offer to stop sending itself.
   */
  unsubscribable?: boolean;
}

export interface EmailProvider {
  send(params: SendEmailParams): Promise<{ success: boolean; error?: string }>;
}
