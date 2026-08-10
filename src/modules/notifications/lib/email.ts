import { getServiceClient } from "@/shared/db/client";
import * as emailDao from "@/shared/db/dao/email.dao";
import { getEmailService } from "@/shared/integrations/email";
import { emailTemplates, type EmailTemplateParams } from "@/shared/integrations/email/templates";
import type { EmailType } from "@/shared/types";

const templateMap: Record<EmailType, keyof typeof emailTemplates> = {
  ticket_issued: "ticketIssued",
  check_in_confirmed: "checkInConfirmed",
  event_survey: "eventSurvey",
};

export async function sendEmailNotification(params: {
  user_id: number;
  email: string;
  name: string;
  email_type: EmailType;
  eventTitle: string;
  eventDate?: string;
  qrDataUrl?: string;
  surveyUrl?: string;
}): Promise<boolean> {
  const template = emailTemplates[templateMap[params.email_type]];

  const eventDate = params.eventDate ?? "";

  try {
    const result = await getEmailService().send({
      to: { email: params.email, name: params.name },
      subject: template.subject,
      // The templates' params differ (QR vs survey URL); the union type wants
      // the intersection, so the per-type fields are cast rather than widened
      // to a shape no single template owns.
      htmlContent: template.buildHtml({
        name: params.name,
        eventTitle: params.eventTitle,
        eventDate,
        qrDataUrl: params.qrDataUrl,
        surveyUrl: params.surveyUrl,
      } as EmailTemplateParams),
      textContent: template.buildText({
        name: params.name,
        eventTitle: params.eventTitle,
        eventDate,
        surveyUrl: params.surveyUrl,
      } as EmailTemplateParams),
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
