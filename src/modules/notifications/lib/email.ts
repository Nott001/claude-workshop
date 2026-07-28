import { getServiceClient } from "@/shared/db/client";
import { emailDao } from "@/shared/db/dao";
import { sendEmail, emailTemplates } from "@/shared/integrations/email";
import type { EmailType } from "@/shared/types";

export async function sendEmailNotification(params: {
  user_id: number;
  email: string;
  name: string;
  email_type: EmailType;
  eventTitle: string;
  eventDate?: string;
  qrDataUrl?: string;
}) {
  const templateKey = params.email_type === "ticket_issued" ? "ticketIssued" : "checkInConfirmed";
  const template = emailTemplates[templateKey];

  const eventDate = params.eventDate ?? "";

  try {
    const result = await sendEmail({
      to: { email: params.email, name: params.name },
      subject: template.subject,
      htmlContent: template.buildHtml({
        name: params.name,
        eventTitle: params.eventTitle,
        eventDate,
        qrDataUrl: params.qrDataUrl,
      }),
    });

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
