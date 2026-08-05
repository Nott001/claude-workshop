import { getServiceClient } from "@/shared/db/client";
import * as emailDao from "@/shared/db/dao/email.dao";
import { getEmailService } from "@/shared/integrations/email";
import { emailTemplates } from "@/shared/integrations/email/templates";
import type { EmailType } from "@/shared/types";

const templateMap: Record<EmailType, keyof typeof emailTemplates> = {
  ticket_issued: "ticketIssued",
  check_in_confirmed: "checkInConfirmed",
};

export async function sendEmailNotification(params: {
  user_id: number;
  email: string;
  name: string;
  email_type: EmailType;
  eventTitle: string;
  eventDate?: string;
  qrDataUrl?: string;
}) {
  const template = emailTemplates[templateMap[params.email_type]];

  const eventDate = params.eventDate ?? "";

  try {
    const result = await getEmailService().send({
      to: { email: params.email, name: params.name },
      subject: template.subject,
      htmlContent: template.buildHtml({
        name: params.name,
        eventTitle: params.eventTitle,
        eventDate,
        qrDataUrl: params.qrDataUrl,
      }),
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
  } catch (err) {
    console.error("Email notification failed:", err);
  }
}
