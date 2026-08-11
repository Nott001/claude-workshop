import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireMinRole, guardFailure, findById, refund } = vi.hoisted(() => ({
  requireMinRole: vi.fn(),
  guardFailure: vi.fn(),
  findById: vi.fn(),
  refund: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireMinRole }));
vi.mock("@/modules/auth/lib/guard-response", () => ({ guardFailure }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/payment.dao", () => ({ findById }));
vi.mock("@/modules/commerce/lib/payment-gateway", () => ({ getPaymentGateway: () => ({ refund }) }));

import { POST } from "@/app/api/payments/[id]/refund/route";

const request = () => new Request("https://app.test/api/payments/77/refund", { method: "POST" });
const params = { params: Promise.resolve({ id: "77" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireMinRole.mockResolvedValue({ allowed: true });
  findById.mockResolvedValue({ id: 77, status: "paid", amount: 500 });
  refund.mockResolvedValue({ refunded: true });
});

describe("POST /api/payments/[id]/refund", () => {
  it("refunds a paid payment for a facilitator", async () => {
    const res = await POST(request(), params);

    expect(refund).toHaveBeenCalledWith({ payment_id: 77 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ refunded: true });
  });

  it("blocks callers below facilitator before touching anything", async () => {
    requireMinRole.mockResolvedValue({ allowed: false });
    guardFailure.mockReturnValue(new Response("Forbidden", { status: 403 }));

    const res = await POST(request(), params);

    expect(res.status).toBe(403);
    expect(refund).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown payment", async () => {
    findById.mockResolvedValue(null);

    const res = await POST(request(), params);

    expect(res.status).toBe(404);
    expect(refund).not.toHaveBeenCalled();
  });

  it("refuses to refund a payment that is not paid", async () => {
    findById.mockResolvedValue({ id: 77, status: "pending", amount: 500 });

    const res = await POST(request(), params);

    expect(res.status).toBe(409);
    expect(refund).not.toHaveBeenCalled();
  });

  it("answers 500 when the provider refund fails", async () => {
    refund.mockRejectedValue(new Error("HitPay refused"));

    const res = await POST(request(), params);

    expect(res.status).toBe(500);
  });
});
