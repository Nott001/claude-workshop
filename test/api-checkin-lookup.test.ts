import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TicketStatus } from "@/shared/types";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const { requireRole, findByQrToken, loadEventOr403 } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findByQrToken: vi.fn(),
  loadEventOr403: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({ findByQrToken }));
vi.mock("@/modules/events/lib/event-service", () => ({ loadEventOr403 }));

import { GET } from "@/app/api/checkin/lookup/route";

function get(query = "") {
  return new Request(`https://app.test/api/checkin/lookup?${query}`, { method: "GET" });
}

const facilitator = { allowed: true, error: null, user: { id: 7, role: ROLES.FACILITATOR } };

function ticket(status: TicketStatus = "issued") {
  return {
    id: 42,
    payment_id: 100,
    user_id: 5,
    event_id: 10,
    qr_token: "tok-123",
    status,
    checked_in_at: status === "checked_in" ? "2026-08-14T10:00:00.000Z" : null,
    USER: { full_name: "Jane Doe", email: "jane@example.com" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(facilitator);
  loadEventOr403.mockResolvedValue({ id: 10 });
});

describe("authorization", () => {
  it("rejects a caller who is not a facilitator", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await GET(get("qr_token=tok"));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("does not touch the database when authorization fails", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    await GET(get("qr_token=tok"));

    expect(findByQrToken).not.toHaveBeenCalled();
  });
});

describe("input validation", () => {
  it.each([undefined, "qr_token="])("rejects a missing or empty token with 400", async (query) => {
    const res = await GET(get(query));
    expect(res.status).toBe(400);
    expect(findByQrToken).not.toHaveBeenCalled();
  });
});

describe("token lookup", () => {
  it("returns 404 for a token that matches no ticket", async () => {
    findByQrToken.mockResolvedValue(null);

    const res = await GET(get("qr_token=forged"));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Invalid QR token" });
    expect(loadEventOr403).not.toHaveBeenCalled();
  });

  it("previews the ticket for a facilitator assigned to the event", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));

    const res = await GET(get("qr_token=tok-123"));

    expect(res.status).toBe(200);
    expect(loadEventOr403).toHaveBeenCalledWith({}, 10, { id: 7, role: ROLES.FACILITATOR }, "attendees");
  });

  it("rejects an unassigned facilitator with 403", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));
    loadEventOr403.mockRejectedValue({ status: 403 });

    const res = await GET(get("qr_token=tok-123"));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("previews the attendee without mutating when the ticket is issued", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));

    const res = await GET(get("qr_token=tok-123"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      attendee: { full_name: "Jane Doe", email: "jane@example.com" },
      qr_token: "tok-123",
      status: "issued",
      checked_in_at: null,
    });
  });

  it("surfaces a checked-in status so the kiosk can refuse the action", async () => {
    findByQrToken.mockResolvedValue(ticket("checked_in"));

    const res = await GET(get("qr_token=tok-123"));

    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ status: "checked_in", checked_in_at: "2026-08-14T10:00:00.000Z" }),
    );
  });

  it("surfaces a cancelled status the same way", async () => {
    findByQrToken.mockResolvedValue(ticket("cancelled"));

    const res = await GET(get("qr_token=tok-123"));

    await expect(res.json()).resolves.toEqual(expect.objectContaining({ status: "cancelled" }));
  });

  it("normalizes a typed code to lowercase before lookup", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));

    const res = await GET(get("qr_token=T0K-123"));

    expect(res.status).toBe(200);
    expect(findByQrToken).toHaveBeenCalledWith({}, "t0k-123");
  });
});
