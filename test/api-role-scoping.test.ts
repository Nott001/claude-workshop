import { describe, it, expect, vi, beforeEach } from "vitest";

// `requireRole("attendee", ...)` admits every authenticated role, because
// hasMinRole treats "attendee" as the floor. The routes below therefore have to
// scope their reads by entitlement rather than by a literal role string — the
// role that exposed the bug is `speaker`, which is neither an attendee nor
// staff and used to fall straight through to the unscoped listing.
const {
  requireRole,
  ticketListByUser,
  ticketListAll,
  paymentListByUser,
  paymentListAll,
  paymentFindById,
  findWithPaymentAndEvent,
  generateQRDataUrl,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  ticketListByUser: vi.fn(),
  ticketListAll: vi.fn(),
  paymentListByUser: vi.fn(),
  paymentListAll: vi.fn(),
  paymentFindById: vi.fn(),
  findWithPaymentAndEvent: vi.fn(),
  generateQRDataUrl: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({
  listByUser: ticketListByUser,
  listAll: ticketListAll,
  findWithPaymentAndEvent,
}));
vi.mock("@/shared/db/dao/payment.dao", () => ({
  listByUser: paymentListByUser,
  listAll: paymentListAll,
  findById: paymentFindById,
}));

vi.mock("@/shared/integrations/qr", () => ({ generateQRDataUrl }));

import { GET as GET_TICKETS } from "@/app/api/tickets/route";
import { GET as GET_PAYMENTS } from "@/app/api/payments/route";
import { GET as GET_PAYMENT } from "@/app/api/payments/[id]/route";
import { GET as GET_TICKET } from "@/app/api/tickets/[paymentId]/route";

const guard = (id: number, role: string) => ({
  allowed: true,
  error: null,
  user: { id, role, full_name: "U", email: "u@example.com", profile_image_url: null },
});

const attendee = guard(5, "attendee");
const speaker = guard(7, "speaker");
const facilitator = guard(9, "facilitator");
const admin = guard(11, "admin");
const superAdmin = guard(12, "super_admin");

const req = () => new Request("https://app.test/x");

beforeEach(() => {
  vi.clearAllMocks();
  ticketListByUser.mockResolvedValue([]);
  ticketListAll.mockResolvedValue([]);
  paymentListByUser.mockResolvedValue([]);
  paymentListAll.mockResolvedValue([]);
  generateQRDataUrl.mockResolvedValue("data:image/png;base64,QR");
});

describe("GET /api/tickets scopes by entitlement", () => {
  it.each([
    ["attendee", attendee],
    ["speaker", speaker],
  ])("%s sees only their own tickets", async (_label, who) => {
    requireRole.mockResolvedValue(who);

    await GET_TICKETS();

    expect(ticketListByUser).toHaveBeenCalledWith({}, who.user.id);
    expect(ticketListAll).not.toHaveBeenCalled();
  });

  it.each([
    ["facilitator", facilitator],
    ["admin", admin],
    ["super_admin", superAdmin],
  ])("%s sees every ticket", async (_label, who) => {
    requireRole.mockResolvedValue(who);

    await GET_TICKETS();

    expect(ticketListAll).toHaveBeenCalled();
    expect(ticketListByUser).not.toHaveBeenCalled();
  });
});

describe("GET /api/payments scopes by entitlement", () => {
  it.each([
    ["attendee", attendee],
    ["speaker", speaker],
  ])("%s sees only their own payments", async (_label, who) => {
    requireRole.mockResolvedValue(who);

    await GET_PAYMENTS();

    expect(paymentListByUser).toHaveBeenCalledWith({}, who.user.id);
    expect(paymentListAll).not.toHaveBeenCalled();
  });

  it.each([
    ["facilitator", facilitator],
    ["admin", admin],
    ["super_admin", superAdmin],
  ])("%s sees every payment", async (_label, who) => {
    requireRole.mockResolvedValue(who);

    await GET_PAYMENTS();

    expect(paymentListAll).toHaveBeenCalled();
    expect(paymentListByUser).not.toHaveBeenCalled();
  });
});

describe("GET /api/payments/[id] hides other users' payments", () => {
  const params = { params: Promise.resolve({ id: "42" }) };

  it.each([
    ["attendee", attendee],
    ["speaker", speaker],
  ])("%s is refused someone else's payment", async (_label, who) => {
    requireRole.mockResolvedValue(who);
    paymentFindById.mockResolvedValue({ id: 42, user_id: 999, amount: 100 });

    const res = await GET_PAYMENT(req(), params);

    expect(res.status).toBe(404);
  });

  it("an attendee still reads their own payment", async () => {
    requireRole.mockResolvedValue(attendee);
    paymentFindById.mockResolvedValue({ id: 42, user_id: attendee.user.id, amount: 100 });

    const res = await GET_PAYMENT(req(), params);

    expect(res.status).toBe(200);
  });

  it("a facilitator reads any payment", async () => {
    requireRole.mockResolvedValue(facilitator);
    paymentFindById.mockResolvedValue({ id: 42, user_id: 999, amount: 100 });

    const res = await GET_PAYMENT(req(), params);

    expect(res.status).toBe(200);
  });
});

describe("GET /api/tickets/[paymentId] hides other users' tickets", () => {
  const params = { params: Promise.resolve({ paymentId: "42" }) };

  it.each([
    ["attendee", attendee],
    ["speaker", speaker],
  ])("%s is refused someone else's ticket, and no QR is rendered", async (_label, who) => {
    requireRole.mockResolvedValue(who);
    findWithPaymentAndEvent.mockResolvedValue({ id: 1, user_id: 999, qr_token: "secret-token" });

    const res = await GET_TICKET(req(), params);

    expect(res.status).toBe(404);
    // The QR is a usable check-in credential, so it must not even be built for
    // a caller who is not entitled to the ticket.
    expect(generateQRDataUrl).not.toHaveBeenCalled();
  });

  it("an attendee still gets a QR for their own ticket", async () => {
    requireRole.mockResolvedValue(attendee);
    findWithPaymentAndEvent.mockResolvedValue({ id: 1, user_id: attendee.user.id, qr_token: "own-token" });

    const res = await GET_TICKET(req(), params);

    expect(res.status).toBe(200);
    expect(generateQRDataUrl).toHaveBeenCalledWith("own-token");
    await expect(res.json()).resolves.toMatchObject({ qr_data_url: "data:image/png;base64,QR" });
  });
});
