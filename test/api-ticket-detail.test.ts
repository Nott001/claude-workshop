import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, findByIdWithEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findByIdWithEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({ findByIdWithEvent }));

import { GET } from "@/app/api/tickets/detail/[ticketId]/route";

function guard(id: number, role: string) {
  return { allowed: true, error: null, user: { id, role, full_name: "U", email: "u@example.com" } };
}

const ticket = {
  id: 42,
  payment_id: 100,
  user_id: 5,
  event_id: 10,
  qr_token: "tok-123",
  status: "issued",
  issued_at: "2026-08-01T00:00:00Z",
  checked_in_by: null,
  checked_in_at: null,
  created_at: "2026-08-01T00:00:00Z",
  updated_at: "2026-08-01T00:00:00Z",
  EVENT: { title: "Launch Day", event_date: "2026-09-01" },
};

const params = { params: Promise.resolve({ ticketId: "42" }) };
const req = () => new Request("https://app.test/api/tickets/detail/42");

beforeEach(() => {
  vi.clearAllMocks();
  findByIdWithEvent.mockResolvedValue(ticket);
});

describe("GET /api/tickets/detail/[ticketId]", () => {
  it("lets the ticket's owner read it", async () => {
    requireRole.mockResolvedValue(guard(5, ROLES.ATTENDEE));

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
    expect(findByIdWithEvent).toHaveBeenCalledWith({}, 42);
    await expect(res.json()).resolves.toEqual(ticket);
  });

  it("returns 404 (not 403) for another attendee's ticket without leaking the row", async () => {
    requireRole.mockResolvedValue(guard(6, ROLES.ATTENDEE));

    const res = await GET(req(), params);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Ticket not found" });
  });

  it("lets a facilitator read any ticket", async () => {
    requireRole.mockResolvedValue(guard(9, ROLES.FACILITATOR));

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
  });

  it("returns 404 for an unknown ticket id", async () => {
    requireRole.mockResolvedValue(guard(5, ROLES.ATTENDEE));
    findByIdWithEvent.mockResolvedValue(null);

    const res = await GET(req(), params);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Ticket not found" });
  });

  it("returns 404 for a non-owner caller below facilitator", async () => {
    requireRole.mockResolvedValue(guard(7, ROLES.SPEAKER));

    const res = await GET(req(), params);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Ticket not found" });
  });

  it("surfaces the guard failure for an unauthorized caller", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await GET(req(), params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });
});
