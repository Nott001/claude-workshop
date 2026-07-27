import { getServiceClient } from "@/lib/db";
import { emailDao } from "@/lib/db/dao";
import { sendEmail, emailTemplates } from "@/lib/email";
import type { EmailType } from "@/types";

export function fireAndForgetEmailNotification(params: {
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

  Promise.allSettled([
    (async () => {
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
      const sentAt = new Date().toISOString();
      await emailDao.insert(supabase, {
        user_id: params.user_id,
        email_type: params.email_type,
        status: result.success ? "sent" : "failed",
        sent_at: sentAt,
      });
    })(),
  ]);
}
