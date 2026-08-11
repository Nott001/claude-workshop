import { describe, it, expect, vi, beforeEach } from "vitest";

const { getEmailService, insert, getServiceClient } = vi.hoisted(() => ({
  getEmailService: vi.fn(),
  insert: vi.fn(),
  getServiceClient: vi.fn(() => ({})),
}));

vi.mock("@/shared/integrations/email", () => ({ getEmailService }));
vi.mock("@/shared/db/dao/email.dao", () => ({ insert }));
vi.mock("@/shared/db/client", () => ({ getServiceClient }));

import { sendEmailNotification } from "@/modules/notifications/lib/email";

const provider = () => ({ send: vi.fn().mockResolvedValue({ success: true }) });

beforeEach(() => {
  vi.clearAllMocks();
  getEmailService.mockReturnValue(provider());
  insert.mockResolvedValue(true);
});

describe("sendEmailNotification", () => {
  it("routes a ticket to the ticket template with the event date and QR", async () => {
    const service = getEmailService();

    const result = await sendEmailNotification({
      user_id: 1,
      email: "ada@example.com",
      name: "Ada",
      email_type: "ticket_issued",
      eventTitle: "Launch Day",
      eventDate: "2026-09-01",
      qrDataUrl: "data:image/png;base64,qr",
    });

    expect(result).toBe(true);
    const payload = service.send.mock.calls[0][0];
    expect(payload.subject).toContain("Registration Confirmed");
    expect(payload.htmlContent).toContain("Launch Day");
    expect(payload.htmlContent).toContain("2026-09-01");
    expect(payload.htmlContent).toContain("data:image/png;base64,qr");
    expect(payload.textContent).toContain("Hi Ada,");
    expect(insert).toHaveBeenCalledWith(
      {},
      {
        user_id: 1,
        email_type: "ticket_issued",
        status: "sent",
        sent_at: expect.any(String),
      },
    );
  });

  it("routes a check-in to the check-in template", async () => {
    const service = getEmailService();

    await sendEmailNotification({
      user_id: 1,
      email: "bob@example.com",
      name: "Bob",
      email_type: "check_in_confirmed",
      eventTitle: "Meetup",
    });

    const payload = service.send.mock.calls[0][0];
    expect(payload.subject).toBe("Check-In Confirmed");
    expect(payload.htmlContent).toContain("Meetup");
    expect(payload.textContent).toContain("Hi Bob,");
  });

  it("routes a survey to the survey template with the attendee's link", async () => {
    const service = getEmailService();

    await sendEmailNotification({
      user_id: 1,
      email: "carol@example.com",
      name: "Carol",
      email_type: "event_survey",
      eventTitle: "Launch Day",
      surveyUrl: "https://startuplab.center/surveys/tok123",
    });

    const payload = service.send.mock.calls[0][0];
    expect(payload.subject).toContain("Share your feedback");
    expect(payload.htmlContent).toContain("https://startuplab.center/surveys/tok123");
    expect(payload.textContent).toContain("https://startuplab.center/surveys/tok123");
    expect(payload.htmlContent).not.toContain("data:image");
  });

  it("logs the send as failed when the provider reports failure", async () => {
    getEmailService.mockReturnValue({ send: vi.fn().mockResolvedValue({ success: false, error: "refused" }) });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const result = await sendEmailNotification({
      user_id: 1,
      email: "ada@example.com",
      name: "Ada",
      email_type: "ticket_issued",
      eventTitle: "Launch Day",
      eventDate: "2026-09-01",
    });

    expect(result).toBe(false);
    expect(insert).toHaveBeenCalledWith({}, expect.objectContaining({ status: "failed" }));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
