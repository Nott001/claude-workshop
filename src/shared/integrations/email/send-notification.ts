import { getServiceClient } from "@/shared/db/client";
import * as emailDao from "@/shared/db/dao/email.dao";
import { getEmailService } from "./index";
import { emailTemplates } from "./templates";
import type { EmailType } from "@/shared/types";

/**
 * The fields each email's template interpolates, keyed by the email_type that
 * selects it. Adding a value to EmailType without a payload here fails to
 * compile, so a new PG enum member cannot reach `buildMessage` unhandled.
 */
interface EmailPayloads extends Record<EmailType, object> {
  ticket_issued: { eventTitle: string; eventDate: string; qrDataUrl?: string };
  check_in_confirmed: { eventTitle: string };
  event_survey: { eventTitle: string; surveyUrl: string };
}

/**
 * One member per email_type. Picking an email_type narrows the params to what
 * that template needs, so the dispatch below calls each template with its own
 * param type rather than a superset cast.
 */
export type SendEmailNotificationParams = {
  [K in EmailType]: { user_id: number; email: string; name: string; email_type: K } & EmailPayloads[K];
}[EmailType];

function compose<P>(
  template: { subject: string; buildHtml: (params: P) => string; buildText: (params: P) => string },
  params: P,
): { subject: string; htmlContent: string; textContent: string } {
  return { subject: template.subject, htmlContent: template.buildHtml(params), textContent: template.buildText(params) };
}

function buildMessage(params: SendEmailNotificationParams) {
  const { name, eventTitle } = params;
  switch (params.email_type) {
    case "ticket_issued":
      return compose(emailTemplates.ticketIssued, {
        name,
        eventTitle,
        eventDate: params.eventDate,
        qrDataUrl: params.qrDataUrl,
      });
    case "check_in_confirmed":
      return compose(emailTemplates.checkInConfirmed, { name, eventTitle });
    case "event_survey":
      return compose(emailTemplates.eventSurvey, { name, eventTitle, surveyUrl: params.surveyUrl });
  }
}

export async function sendEmailNotification(params: SendEmailNotificationParams): Promise<boolean> {
  const message = buildMessage(params);

  try {
    const result = await getEmailService().send({
      to: { email: params.email, name: params.name },
      subject: message.subject,
      htmlContent: message.htmlContent,
      textContent: message.textContent,
    });

    if (!result.success && result.error) {
      console.warn("Email send failed:", result.error);
    }

    const supabase = getServiceClient();
    await emailDao.insert(supabase, {
      user_id: params.user_id,
      email_type: params.email_type,
      status: result.success ? "sent" : "failed",
      sent_at: new Date().toISOString(),
    });

    // Survey retries key off delivery, so the caller needs to know whether the
    // send went out rather than assuming a log row means it did.
    return result.success;
  } catch (err) {
    // A failed send used to vanish here. The caller decides whether a mail
    // failure should fail its own operation, so the error is logged and
    // rethrown — both send sites run inside afterResponse, which records it.
    console.error("Email notification failed:", err);
    throw err;
  }
}
