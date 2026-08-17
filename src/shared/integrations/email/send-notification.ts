import { getServiceClient } from "@/shared/db/client";
import * as emailDao from "@/shared/db/dao/email.dao";
import { sendTemplatedEmail } from "./send-templated";
import { emailTemplates } from "./templates";
import type { EmailType } from "@/shared/types";

/**
 * The fields each email's template interpolates, keyed by the email_type that
 * selects it. Adding a value to EmailType without a payload here fails to
 * compile, so a new PG enum member cannot reach `buildMessage` unhandled.
 */
interface EmailPayloads extends Record<EmailType, object> {
  ticket_issued: { eventTitle: string; eventDate: string; code: string; qrDataUrl?: string };
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

/** Each branch applies its own param type, so no superset cast is needed. */
function sendForType(params: SendEmailNotificationParams) {
  const { name, eventTitle } = params;
  const to = { email: params.email, name };

  switch (params.email_type) {
    case "ticket_issued":
      return sendTemplatedEmail(
        emailTemplates.ticketIssued,
        { name, eventTitle, eventDate: params.eventDate, code: params.code, qrDataUrl: params.qrDataUrl },
        to,
      );
    case "check_in_confirmed":
      return sendTemplatedEmail(emailTemplates.checkInConfirmed, { name, eventTitle }, to);
    case "event_survey":
      return sendTemplatedEmail(emailTemplates.eventSurvey, { name, eventTitle, surveyUrl: params.surveyUrl }, to);
  }
}

export async function sendEmailNotification(params: SendEmailNotificationParams): Promise<boolean> {
  try {
    const result = await sendForType(params);

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
    // rethrown. Ticket issuing throws this into `afterResponse`, which records
    // it; the survey send catches it per recipient and leaves `sent_at` null so
    // the next batch retries that one. Neither wants it swallowed here.
    console.error("Email notification failed:", err);
    throw err;
  }
}
