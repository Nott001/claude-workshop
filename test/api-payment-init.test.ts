import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, findEventForPayment, findLatestByUserAndEvent, findActiveByUserAndEvent, create, createPayment } =
  vi.hoisted(() => ({
    requireAuth: vi.fn(),
    findEventForPayment: vi.fn(),
    findLatestByUserAndEvent: vi.fn(),
    findActiveByUserAndEvent: vi.fn(),
    create: vi.fn(),
    createPayment: vi.fn(),
  }));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole: vi.fn() }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao", () => ({
  paymentDao: { findEventForPayment, findLatestByUserAndEvent, create },
  ticketDao: { findActiveByUserAndEvent },
}));
vi.mock("@/modules/commerce/lib/payment-gateway", () => ({
  SimulatedPaymentGateway: class {
    createPayment = createPayment;
  },
}));

import { POST } from "@/app/api/payments/route";

const user = { id: 5, role: "attendee", full_name: "Jane", email: "jane@example.com" };
const event = { id: 3, status: "active", price: 100, currency: "SGD" };
const post = () => new Request("https://app.test/api/payments", { method: "POST", body: JSON.stringify({ event_id: "3" }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(user);
  findEventForPayment.mockResolvedValue(event);
  findLatestByUserAndEvent.mockResolvedValue(null);
  findActiveByUserAndEvent.mockResolvedValue([]);
  create.mockResolvedValue({ id: 77 });
  createPayment.mockResolvedValue({ checkout_url: "https://pay.test/77" });
});

describe("double-ticketing", () => {
  // The gateway used to run on a stale pending payment *before* the
  // active-ticket check, so a user holding a live ticket could check out again
  // and be issued a second one. Nothing in the schema prevents the duplicate.
  it("refuses a user who already holds an active ticket, even with a pending payment", async () => {
    findActiveByUserAndEvent.mockResolvedValue([{ id: 1, status: "issued" }]);
    findLatestByUserAndEvent.mockResolvedValue({ id: 42, status: "pending" });

    const res = await POST(post());

    expect(res.status).toBe(409);
    expect(createPayment).not.toHaveBeenCalled();
  });

  it("refuses a user who already holds an active ticket and has no pending payment", async () => {
    findActiveByUserAndEvent.mockResolvedValue([{ id: 1, status: "issued" }]);

    const res = await POST(post());

    expect(res.status).toBe(409);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("checkout", () => {
  it("resumes a pending payment when no active ticket exists", async () => {
    findLatestByUserAndEvent.mockResolvedValue({ id: 42, status: "pending" });

    const res = await POST(post());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ payment_id: 42 });
    // Resumed, not duplicated.
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a new payment for a first-time buyer", async () => {
    const res = await POST(post());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ payment_id: 77 });
    expect(create).toHaveBeenCalled();
  });

  it("does not sell a draft event", async () => {
    findEventForPayment.mockResolvedValue({ ...event, status: "draft" });

    const res = await POST(post());

    expect(res.status).toBe(404);
    expect(createPayment).not.toHaveBeenCalled();
  });
});
