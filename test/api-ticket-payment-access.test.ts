import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireRole,
  listByUser,
  listAll,
  findWithPaymentAndEvent,
  paymentListByUser,
  paymentListAll,
  paymentFindById,
  generateQRDataUrl,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  listByUser: vi.fn(),
  listAll: vi.fn(),
  findWithPaymentAndEvent: vi.fn(),
  paymentListByUser: vi.fn(),
  paymentListAll: vi.fn(),
  paymentFindById: vi.fn(),
  generateQRDataUrl: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao", () => ({
  ticketDao: { listByUser, listAll, findWithPaymentAndEvent },
  paymentDao: { listByUser: paymentListByUser, listAll: paymentListAll, findById: paymentFindById },
}));
vi.mock("@/shared/integrations/qr", () => ({ generateQRDataUrl }));

import { GET as getTickets } from "@/app/api/tickets/route";
import { GET as getTicket } from "@/app/api/tickets/[paymentId]/route";
import { GET as getPayments } from "@/app/api/payments/route";
import { GET as getPayment } from "@/app/api/payments/[id]/route";

function guard(role: string) {
  return { allowed: true, error: null, user: { id: 42, role } };
}

const ticket = { payment_id: 7, user_id: 42, qr_token: "qr-abc" };
const payment = { id: 7, user_id: 42, amount: 100 };

beforeEach(() => {
  vi.clearAllMocks();
  generateQRDataUrl.mockResolvedValue("data:image/png;base64,AAAA");
  listByUser.mockResolvedValue([ticket]);
  listAll.mockResolvedValue([ticket]);
  paymentListByUser.mockResolvedValue([payment]);
  paymentListAll.mockResolvedValue([payment]);
});

describe("GET /api/tickets", () => {
  it("rejects an unauthenticated caller", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await getTickets();

    expect(res.status).toBe(401);
    expect(listByUser).not.toHaveBeenCalled();
    expect(listAll).not.toHaveBeenCalled();
  });

  it("scopes an attendee to their own tickets", async () => {
    requireRole.mockResolvedValue(guard("attendee"));

    const res = await getTickets();

    expect(res.status).toBe(200);
    expect(listByUser).toHaveBeenCalledWith({}, 42);
    expect(listAll).not.toHaveBeenCalled();
  });

  it("scopes a speaker to their own tickets instead of returning everyone's", async () => {
    requireRole.mockResolvedValue(guard("speaker"));

    const res = await getTickets();

    expect(res.status).toBe(200);
    expect(listByUser).toHaveBeenCalledWith({}, 42);
    expect(listAll).not.toHaveBeenCalled();
  });

  it("lets a facilitator list every ticket", async () => {
    requireRole.mockResolvedValue(guard("facilitator"));

    const res = await getTickets();

    expect(res.status).toBe(200);
    expect(listAll).toHaveBeenCalledWith({});
    expect(listByUser).not.toHaveBeenCalled();
  });
});

describe("GET /api/tickets/[paymentId]", () => {
  it("rejects an unauthenticated caller", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await getTicket(new Request("https://app.test/api/tickets/7"), { params: Promise.resolve({ paymentId: "7" }) });

    expect(res.status).toBe(401);
    expect(findWithPaymentAndEvent).not.toHaveBeenCalled();
  });

  it("returns 404 for a missing ticket", async () => {
    requireRole.mockResolvedValue(guard("attendee"));
    findWithPaymentAndEvent.mockResolvedValue(null);

    const res = await getTicket(new Request("https://app.test/api/tickets/7"), { params: Promise.resolve({ paymentId: "7" }) });

    expect(res.status).toBe(404);
    expect(generateQRDataUrl).not.toHaveBeenCalled();
  });

  it("returns an attendee their own ticket with its QR code", async () => {
    requireRole.mockResolvedValue(guard("attendee"));
    findWithPaymentAndEvent.mockResolvedValue(ticket);

    const res = await getTicket(new Request("https://app.test/api/tickets/7"), { params: Promise.resolve({ paymentId: "7" }) });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ...ticket, qr_data_url: "data:image/png;base64,AAAA" });
  });

  it("hides someone else's ticket from an attendee", async () => {
    requireRole.mockResolvedValue(guard("attendee"));
    findWithPaymentAndEvent.mockResolvedValue({ ...ticket, user_id: 99 });

    const res = await getTicket(new Request("https://app.test/api/tickets/7"), { params: Promise.resolve({ paymentId: "7" }) });

    expect(res.status).toBe(404);
    expect(generateQRDataUrl).not.toHaveBeenCalled();
  });

  it("hides someone else's ticket from a speaker instead of leaking the QR code", async () => {
    requireRole.mockResolvedValue(guard("speaker"));
    findWithPaymentAndEvent.mockResolvedValue({ ...ticket, user_id: 99 });

    const res = await getTicket(new Request("https://app.test/api/tickets/7"), { params: Promise.resolve({ paymentId: "7" }) });

    expect(res.status).toBe(404);
    expect(generateQRDataUrl).not.toHaveBeenCalled();
  });

  it("returns a speaker their own ticket", async () => {
    requireRole.mockResolvedValue(guard("speaker"));
    findWithPaymentAndEvent.mockResolvedValue(ticket);

    const res = await getTicket(new Request("https://app.test/api/tickets/7"), { params: Promise.resolve({ paymentId: "7" }) });

    expect(res.status).toBe(200);
  });

  it("lets a facilitator view any ticket regardless of ownership", async () => {
    requireRole.mockResolvedValue(guard("facilitator"));
    findWithPaymentAndEvent.mockResolvedValue({ ...ticket, user_id: 99 });

    const res = await getTicket(new Request("https://app.test/api/tickets/7"), { params: Promise.resolve({ paymentId: "7" }) });

    expect(res.status).toBe(200);
  });
});

describe("GET /api/payments", () => {
  it("scopes an attendee to their own payments", async () => {
    requireRole.mockResolvedValue(guard("attendee"));

    const res = await getPayments();

    expect(res.status).toBe(200);
    expect(paymentListByUser).toHaveBeenCalledWith({}, 42);
    expect(paymentListAll).not.toHaveBeenCalled();
  });

  it("scopes a speaker to their own payments instead of returning everyone's", async () => {
    requireRole.mockResolvedValue(guard("speaker"));

    const res = await getPayments();

    expect(res.status).toBe(200);
    expect(paymentListByUser).toHaveBeenCalledWith({}, 42);
    expect(paymentListAll).not.toHaveBeenCalled();
  });

  it("lets a facilitator list every payment", async () => {
    requireRole.mockResolvedValue(guard("facilitator"));

    const res = await getPayments();

    expect(res.status).toBe(200);
    expect(paymentListAll).toHaveBeenCalledWith({});
    expect(paymentListByUser).not.toHaveBeenCalled();
  });
});

describe("GET /api/payments/[id]", () => {
  it("returns 404 for a missing payment", async () => {
    requireRole.mockResolvedValue(guard("attendee"));
    paymentFindById.mockResolvedValue(null);

    const res = await getPayment(new Request("https://app.test/api/payments/7"), { params: Promise.resolve({ id: "7" }) });

    expect(res.status).toBe(404);
  });

  it("returns an attendee their own payment", async () => {
    requireRole.mockResolvedValue(guard("attendee"));
    paymentFindById.mockResolvedValue(payment);

    const res = await getPayment(new Request("https://app.test/api/payments/7"), { params: Promise.resolve({ id: "7" }) });

    expect(res.status).toBe(200);
  });

  it("hides someone else's payment from an attendee", async () => {
    requireRole.mockResolvedValue(guard("attendee"));
    paymentFindById.mockResolvedValue({ ...payment, user_id: 99 });

    const res = await getPayment(new Request("https://app.test/api/payments/7"), { params: Promise.resolve({ id: "7" }) });

    expect(res.status).toBe(404);
  });

  it("hides someone else's payment from a speaker", async () => {
    requireRole.mockResolvedValue(guard("speaker"));
    paymentFindById.mockResolvedValue({ ...payment, user_id: 99 });

    const res = await getPayment(new Request("https://app.test/api/payments/7"), { params: Promise.resolve({ id: "7" }) });

    expect(res.status).toBe(404);
  });

  it("returns a speaker their own payment", async () => {
    requireRole.mockResolvedValue(guard("speaker"));
    paymentFindById.mockResolvedValue(payment);

    const res = await getPayment(new Request("https://app.test/api/payments/7"), { params: Promise.resolve({ id: "7" }) });

    expect(res.status).toBe(200);
  });

  it("lets a facilitator view any payment regardless of ownership", async () => {
    requireRole.mockResolvedValue(guard("facilitator"));
    paymentFindById.mockResolvedValue({ ...payment, user_id: 99 });

    const res = await getPayment(new Request("https://app.test/api/payments/7"), { params: Promise.resolve({ id: "7" }) });

    expect(res.status).toBe(200);
  });
});
