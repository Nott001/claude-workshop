import { createHmac } from "node:crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const {
  paymentFindById,
  updateStatus,
  findByGatewayReference,
  ticketCreate,
  findByPaymentId,
  ticketUpdateStatus,
  sendEmailNotification,
  generateQRDataUrl,
} = vi.hoisted(() => ({
  paymentFindById: vi.fn(),
  updateStatus: vi.fn(),
  findByGatewayReference: vi.fn(),
  ticketCreate: vi.fn(),
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
  findByPaymentId,
  updateStatus: ticketUpdateStatus,
}));
vi.mock("@/modules/notifications/lib/email", () => ({ sendEmailNotification }));
vi.mock("@/shared/integrations/qr", () => ({ generateQRDataUrl }));
// Run the deferred work inline so its effects are observable here.
vi.mock("@/shared/lib/after-response", () => ({
  afterResponse: (work: () => Promise<unknown>) => work(),
}));

import { HitPayPaymentGateway } from "@/modules/commerce/lib/providers/hitpay";

const BASE = "https://api.sandbox.hit-pay.com/v1";
const SALT = "salty";

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

const WEBHOOK_ROW = {
  id: 77,
  user_id: 5,
  event_id: 3,
  gateway_reference_id: "hp_123",
  status: "pending",
  EVENT: { title: "Founder Workshop", event_date: "2026-09-01" },
  USER: { full_name: "Jane Doe", email: "jane@example.com" },
};

const gateway = () => new HitPayPaymentGateway({ apiKey: "key_123", salt: SALT, baseUrl: BASE, paymentMethods: [] });
const signed = (payload: string) => createHmac("sha256", SALT).update(payload).digest("hex");
const okJson = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => "",
});

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  paymentFindById.mockResolvedValue({
    id: 77,
    status: "pending",
    amount: 500,
    currency: "PHP",
    gateway_reference_id: "hp_123",
  });
  updateStatus.mockResolvedValue(true);
  findByGatewayReference.mockResolvedValue(WEBHOOK_ROW);
  ticketCreate.mockResolvedValue({ id: 9 });
  findByPaymentId.mockResolvedValue(null);
  ticketUpdateStatus.mockResolvedValue(true);
  generateQRDataUrl.mockResolvedValue("data:image/png;base64,QUJD");
  sendEmailNotification.mockResolvedValue(undefined);
});

afterEach(() => vi.unstubAllGlobals());

describe("HitPayPaymentGateway.createPayment", () => {
  it("opens a payment request with the right URL, body and api key", async () => {
    fetchMock.mockResolvedValue(okJson({ id: "hp_123", url: "https://checkout.test/x" }));

    const result = await gateway().createPayment(OPTIONS);

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/payment-requests`);
    expect(new Headers(init.headers).get("X-BUSINESS-API-KEY")).toBe("key_123");

    const body = new URLSearchParams(init.body);
    expect(body.get("amount")).toBe("500.00");
    expect(body.get("currency")).toBe("PHP");
    expect(body.get("reference_number")).toBe("77");
    expect(body.get("email")).toBe("jane@example.com");
    expect(body.get("send_email")).toBe("false");
    expect(body.get("redirect_url")).toContain("/checkout/77");

    expect(result).toEqual({ checkout_url: "https://checkout.test/x", gateway_reference_id: "hp_123" });
  });

  it("forwards configured payment methods to HitPay", async () => {
    fetchMock.mockResolvedValue(okJson({ id: "hp_123", url: "https://checkout.test/x" }));

    await new HitPayPaymentGateway({
      apiKey: "key_123",
      salt: SALT,
      baseUrl: BASE,
      paymentMethods: ["card", "paynow"],
    }).createPayment(OPTIONS);

    const body = new URLSearchParams(fetchMock.mock.calls[0][1].body);
    expect(body.getAll("payment_methods[]")).toEqual(["card", "paynow"]);
  });

  it("surfaces a HitPay failure with its status", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, json: async () => ({}), text: async () => "forbidden" });

    await expect(gateway().createPayment(OPTIONS)).rejects.toThrow(/HitPay create payment request failed \(403\): forbidden/);
  });
});

describe("HitPayPaymentGateway.confirmWebhook", () => {
  it("rejects a webhook with no signature", async () => {
    await expect(gateway().confirmWebhook({ payload: "{}", signature: null })).rejects.toMatchObject({
      name: "PaymentWebhookError",
      status: 401,
    });
  });

  it("rejects a webhook whose signature does not match the salt", async () => {
    await expect(gateway().confirmWebhook({ payload: "{}", signature: "deadbeef" })).rejects.toMatchObject({
      status: 400,
    });
  });

  it("fulfils a signed completed webhook through the shared path", async () => {
    const payload = JSON.stringify({ id: "hp_123", status: "completed" });

    const result = await gateway().confirmWebhook({ payload, signature: signed(payload) });

    expect(result.outcome).toBe("paid");
    expect(findByGatewayReference).toHaveBeenCalledWith({}, "hp_123");
    expect(updateStatus).toHaveBeenCalledWith({}, 77, "paid");
    expect(ticketCreate).toHaveBeenCalled();
    expect(sendEmailNotification).toHaveBeenCalled();
  });

  it("marks a signed failed webhook failed without issuing a ticket", async () => {
    const payload = JSON.stringify({ id: "hp_123", status: "failed" });

    const result = await gateway().confirmWebhook({ payload, signature: signed(payload) });

    expect(result.outcome).toBe("failed");
    expect(updateStatus).toHaveBeenCalledWith({}, 77, "failed");
    expect(ticketCreate).not.toHaveBeenCalled();
  });

  it("ignores pending statuses rather than settling anything", async () => {
    const payload = JSON.stringify({ id: "hp_123", status: "pending" });

    const result = await gateway().confirmWebhook({ payload, signature: signed(payload) });

    expect(result.outcome).toBe("ignored");
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("ignores a completed webhook for a reference it does not know", async () => {
    findByGatewayReference.mockResolvedValue(null);
    const payload = JSON.stringify({ id: "hp_unknown", status: "completed" });

    const result = await gateway().confirmWebhook({ payload, signature: signed(payload) });

    expect(result.outcome).toBe("ignored");
    expect(updateStatus).not.toHaveBeenCalled();
    expect(ticketCreate).not.toHaveBeenCalled();
  });

  it("rejects a signature claimed against garbage payload bytes", async () => {
    const payload = "{ not json";

    await expect(gateway().confirmWebhook({ payload, signature: signed(payload) })).rejects.toMatchObject({
      status: 400,
      message: /not valid JSON/,
    });
  });
});

describe("HitPayPaymentGateway.refund", () => {
  beforeEach(() => {
    paymentFindById.mockResolvedValue({ id: 77, status: "paid", amount: 500, currency: "PHP", gateway_reference_id: "hp_123" });
  });

  it("sends the gateway reference to HitPay and marks the payment refunded", async () => {
    fetchMock.mockResolvedValue(okJson({}));

    const result = await gateway().refund({ payment_id: 77 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/refund`);
    expect(JSON.parse(init.body)).toEqual({ amount: 500, payment_id: "hp_123", send_email: "false" });
    expect(result.refunded).toBe(true);
    expect(updateStatus).toHaveBeenCalledWith({}, 77, "refunded");
  });

  it("refunds a partial amount when one is given", async () => {
    fetchMock.mockResolvedValue(okJson({}));

    await gateway().refund({ payment_id: 77, amount: 200 });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).amount).toBe(200);
  });

  it("refuses to refund a payment HitPay does not track", async () => {
    paymentFindById.mockResolvedValue({ id: 77, status: "paid", amount: 500, gateway_reference_id: null });

    await expect(gateway().refund({ payment_id: 77 })).rejects.toThrow(/no gateway reference/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces a HitPay refund failure without marking anything", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 400, json: async () => ({}), text: async () => "bad request" });

    await expect(gateway().refund({ payment_id: 77 })).rejects.toThrow(/HitPay refund failed \(400\): bad request/);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
