import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  paymentFindById,
  updateStatus,
  findByGatewayReference,
  ticketCreate,
  findActiveByQrToken,
  findByPaymentId,
  ticketUpdateStatus,
  sendEmailNotification,
  generateQRDataUrl,
} = vi.hoisted(() => ({
  paymentFindById: vi.fn(),
  updateStatus: vi.fn(),
  findByGatewayReference: vi.fn(),
  ticketCreate: vi.fn(),
  findActiveByQrToken: vi.fn(),
  findByPaymentId: vi.fn(),
  ticketUpdateStatus: vi.fn(),
  sendEmailNotification: vi.fn(),
  generateQRDataUrl: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/payment.dao", () => ({
  findById: paymentFindById,
  updateStatus,
  findByGatewayReference,
}));
vi.mock("@/shared/db/dao/ticket.dao", () => ({
  create: ticketCreate,
  findActiveByQrToken,
  findByPaymentId,
  updateStatus: ticketUpdateStatus,
}));
vi.mock("@/shared/integrations/email/send-notification", () => ({ sendEmailNotification }));
vi.mock("@/shared/integrations/qr", () => ({ generateQRDataUrl }));
// Run the deferred work inline so its effects are observable here.
vi.mock("@/shared/lib/after-response", () => ({
  afterResponse: (work: () => Promise<unknown>) => work(),
}));

import { SimulatedPaymentGateway } from "@/modules/commerce/lib/providers/simulated";

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

const PENDING_PAYMENT = { id: 77, status: "pending" };

const WEBHOOK_ROW = {
  id: 77,
  user_id: 5,
  event_id: 3,
  gateway_reference_id: "77",
  status: "pending",
  EVENT: { title: "Founder Workshop", event_date: "2026-09-01" },
  USER: { full_name: "Jane Doe", email: "jane@example.com" },
};

beforeEach(() => {
  vi.clearAllMocks();
  paymentFindById.mockResolvedValue(PENDING_PAYMENT);
  updateStatus.mockResolvedValue(true);
  ticketCreate.mockResolvedValue({ id: 9 });
  findActiveByQrToken.mockResolvedValue(null);
  findByPaymentId.mockResolvedValue(null);
  ticketUpdateStatus.mockResolvedValue(true);
  generateQRDataUrl.mockResolvedValue("data:image/png;base64,QUJD");
  sendEmailNotification.mockResolvedValue(undefined);
});

describe("SimulatedPaymentGateway.createPayment", () => {
  it("fulfils the payment through the shared path the webhook uses", async () => {
    await new SimulatedPaymentGateway().createPayment(OPTIONS);

    expect(paymentFindById).toHaveBeenCalledWith({}, 77);
    expect(updateStatus).toHaveBeenCalledWith({}, 77, "paid");
  });

  it("builds the ticket email from the event it was given", async () => {
    await new SimulatedPaymentGateway().createPayment(OPTIONS);

    expect(sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        email_type: "ticket_issued",
        email: "jane@example.com",
        eventTitle: "Founder Workshop",
        eventDate: "2026-09-01",
        code: expect.stringMatching(/^[0-9a-f]{6}$/),
        qrDataUrl: "data:image/png;base64,QUJD",
      }),
    );
  });

  it("issues a ticket carrying a QR token", async () => {
    await new SimulatedPaymentGateway().createPayment(OPTIONS);

    expect(ticketCreate).toHaveBeenCalledWith({}, expect.objectContaining({ payment_id: 77, user_id: 5, event_id: 3 }));
    expect(ticketCreate.mock.calls[0][1].qr_token).toMatch(/^[0-9a-f]{6}$/);
  });

  it("re-draws a token when the first draw collides with a live ticket", async () => {
    findActiveByQrToken
      .mockResolvedValueOnce({ id: 1 }) // first draw taken
      .mockResolvedValueOnce(null); // second draw free

    await new SimulatedPaymentGateway().createPayment(OPTIONS);

    expect(findActiveByQrToken).toHaveBeenCalledTimes(2);
    const issued = ticketCreate.mock.calls[0][1].qr_token;
    expect(issued).toMatch(/^[0-9a-f]{6}$/);
    expect(ticketCreate).toHaveBeenCalledTimes(1);
  });

  it("fails loudly when no free code can be drawn", async () => {
    findActiveByQrToken.mockResolvedValue({ id: 1 });

    await expect(new SimulatedPaymentGateway().createPayment(OPTIONS)).rejects.toThrow(/Could not allocate a unique QR token/);
    expect(ticketCreate).not.toHaveBeenCalled();
    expect(sendEmailNotification).not.toHaveBeenCalled();
  });

  it("returns a gateway reference but no checkout URL", async () => {
    const result = await new SimulatedPaymentGateway().createPayment(OPTIONS);

    expect(result.checkout_url).toBe("");
    expect(result.gateway_reference_id).toBe("77");
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

  it("refuses to settle a payment that is already paid out", async () => {
    paymentFindById.mockResolvedValue({ id: 77, status: "refunded" });

    await expect(new SimulatedPaymentGateway().createPayment(OPTIONS)).rejects.toThrow(/cannot be marked paid/);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("SimulatedPaymentGateway.confirmWebhook", () => {
  it("fulfils a completed webhook for the referenced payment", async () => {
    findByGatewayReference.mockResolvedValue(WEBHOOK_ROW);

    const result = await new SimulatedPaymentGateway().confirmWebhook({
      payload: JSON.stringify({ reference: "77", status: "completed" }),
      signature: null,
    });

    expect(result.outcome).toBe("paid");
    expect(findByGatewayReference).toHaveBeenCalledWith({}, "77");
    expect(updateStatus).toHaveBeenCalledWith({}, 77, "paid");
    expect(sendEmailNotification).toHaveBeenCalled();
  });

  it("marks a failed webhook failed without issuing a ticket", async () => {
    findByGatewayReference.mockResolvedValue(WEBHOOK_ROW);

    const result = await new SimulatedPaymentGateway().confirmWebhook({
      payload: JSON.stringify({ reference: "77", status: "failed" }),
      signature: null,
    });

    expect(result.outcome).toBe("failed");
    expect(updateStatus).toHaveBeenCalledWith({}, 77, "failed");
    expect(ticketCreate).not.toHaveBeenCalled();
  });

  it("ignores a webhook naming no payment", async () => {
    const result = await new SimulatedPaymentGateway().confirmWebhook({
      payload: JSON.stringify({ status: "completed" }),
      signature: null,
    });

    expect(result.outcome).toBe("ignored");
    expect(findByGatewayReference).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("ignores a webhook for a reference it does not know", async () => {
    findByGatewayReference.mockResolvedValue(null);

    const result = await new SimulatedPaymentGateway().confirmWebhook({
      payload: JSON.stringify({ reference: "nope", status: "completed" }),
      signature: null,
    });

    expect(result.outcome).toBe("ignored");
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("SimulatedPaymentGateway.refund", () => {
  it("marks the payment refunded and cancels its live ticket", async () => {
    paymentFindById.mockResolvedValue({ id: 77, status: "paid" });
    findByPaymentId.mockResolvedValue({ id: 5, status: "issued" });

    const result = await new SimulatedPaymentGateway().refund({ payment_id: 77 });

    expect(result.refunded).toBe(true);
    expect(updateStatus).toHaveBeenCalledWith({}, 77, "refunded");
    expect(ticketUpdateStatus).toHaveBeenCalledWith({}, 5, "cancelled");
  });

  it("leaves an already-refunded payment alone", async () => {
    paymentFindById.mockResolvedValue({ id: 77, status: "refunded" });

    await new SimulatedPaymentGateway().refund({ payment_id: 77 });

    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("refuses to refund a payment that was never paid", async () => {
    paymentFindById.mockResolvedValue({ id: 77, status: "pending" });

    await expect(new SimulatedPaymentGateway().refund({ payment_id: 77 })).rejects.toThrow(/cannot be marked refunded/);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
