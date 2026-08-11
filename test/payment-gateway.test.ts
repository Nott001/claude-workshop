import { describe, it, expect, vi, beforeEach } from "vitest";

const { updateStatus, findEventForPayment, ticketCreate, sendEmailNotification, generateQRDataUrl } = vi.hoisted(() => ({
  updateStatus: vi.fn(),
  findEventForPayment: vi.fn(),
  ticketCreate: vi.fn(),
  sendEmailNotification: vi.fn(),
  generateQRDataUrl: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/payment.dao", () => ({ updateStatus, findEventForPayment }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({ create: ticketCreate }));
vi.mock("@/shared/integrations/email/send-notification", () => ({ sendEmailNotification }));
vi.mock("@/shared/integrations/qr", () => ({ generateQRDataUrl }));
// Run the deferred work inline so its effects are observable here.
vi.mock("@/shared/lib/after-response", () => ({
  afterResponse: (work: () => Promise<unknown>) => work(),
}));

import { SimulatedPaymentGateway } from "@/modules/commerce/lib/payment-gateway";

const OPTIONS = {
  amount: 500,
  currency: "PHP",
  payment_id: 77,
  user_id: 5,
  event_id: 3,
  user_email: "jane@example.com",
  user_name: "Jane Doe",
  event: { title: "Founder Workshop", event_date: "2026-09-01" },
};

beforeEach(() => {
  vi.clearAllMocks();
  updateStatus.mockResolvedValue(true);
  ticketCreate.mockResolvedValue({ id: 9 });
  generateQRDataUrl.mockResolvedValue("data:image/png;base64,QUJD");
  sendEmailNotification.mockResolvedValue(undefined);
});

describe("SimulatedPaymentGateway.createPayment", () => {
  it("does not re-read the event the caller already loaded", async () => {
    await new SimulatedPaymentGateway().createPayment(OPTIONS);

    // This was a second round trip for a row the route had in hand.
    expect(findEventForPayment).not.toHaveBeenCalled();
  });

  it("builds the ticket email from the event it was given", async () => {
    await new SimulatedPaymentGateway().createPayment(OPTIONS);

    expect(sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        email_type: "ticket_issued",
        email: "jane@example.com",
        eventTitle: "Founder Workshop",
        eventDate: "2026-09-01",
        qrDataUrl: "data:image/png;base64,QUJD",
      }),
    );
  });

  it("marks the payment paid and issues a ticket carrying a QR token", async () => {
    await new SimulatedPaymentGateway().createPayment(OPTIONS);

    expect(updateStatus).toHaveBeenCalledWith({}, 77, "paid");
    expect(ticketCreate).toHaveBeenCalledWith({}, expect.objectContaining({ payment_id: 77, user_id: 5, event_id: 3 }));
    expect(ticketCreate.mock.calls[0][1].qr_token).toMatch(/\S/);
  });

  it("returns a checkout URL for the payment it settled", async () => {
    const result = await new SimulatedPaymentGateway().createPayment(OPTIONS);

    expect(result.checkout_url).toContain("/checkout/77?success=true");
  });

  it("issues no ticket when the payment cannot be marked paid", async () => {
    updateStatus.mockResolvedValue(false);

    await expect(new SimulatedPaymentGateway().createPayment(OPTIONS)).rejects.toThrow(/mark payment as paid/);
    expect(ticketCreate).not.toHaveBeenCalled();
    expect(sendEmailNotification).not.toHaveBeenCalled();
  });

  it("sends nothing when the ticket cannot be issued", async () => {
    ticketCreate.mockResolvedValue(null);

    await expect(new SimulatedPaymentGateway().createPayment(OPTIONS)).rejects.toThrow(/issue ticket/);
    expect(sendEmailNotification).not.toHaveBeenCalled();
  });
});
