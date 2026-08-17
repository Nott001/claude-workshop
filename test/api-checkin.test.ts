import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { TicketStatus } from "@/shared/types";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const { requireRole, findByQrToken, updateStatus, findById, sendEmailNotification, logAuditEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findByQrToken: vi.fn(),
  updateStatus: vi.fn(),
  findById: vi.fn(),
  sendEmailNotification: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({ findByQrToken, updateStatus }));
vi.mock("@/modules/events/db/event.dao", () => ({ findById }));

vi.mock("@/shared/integrations/email/send-notification", () => ({ sendEmailNotification }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));

import { POST } from "@/app/api/checkin/route";

function post(body: unknown) {
  return new Request("https://app.test/api/checkin", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const facilitator = { allowed: true, error: null, user: { id: 7, role: ROLES.FACILITATOR } };

function ticket(status: TicketStatus = "issued") {
  return {
    id: 42,
    payment_id: 100,
    user_id: 5,
    event_id: 10,
    status,
    USER: { full_name: "Jane Doe", email: "jane@example.com" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(facilitator);
  updateStatus.mockResolvedValue(true);
  findById.mockResolvedValue({ title: "Launch Day", event_date: "2026-08-01" });
});

describe("authorization", () => {
  it("rejects a caller who is not a facilitator", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await POST(post({ qr_token: "tok" }));

    // Authenticated but not permitted is 403; 401 is reserved for "not signed in".
    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
  });

  it("does not touch the database when authorization fails", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    await POST(post({ qr_token: "tok" }));

    expect(findByQrToken).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("only admits the facilitator role", async () => {
    await POST(post({ qr_token: "tok" }));
    expect(requireRole).toHaveBeenCalledWith(ROLES.FACILITATOR);
  });
});

describe("input validation", () => {
  it.each([{}, { qr_token: "" }, { qr_token: null }])("rejects %j with 400", async (body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    expect(findByQrToken).not.toHaveBeenCalled();
  });
});

describe("token lookup", () => {
  it("returns 404 for a token that matches no ticket", async () => {
    findByQrToken.mockResolvedValue(null);

    const res = await POST(post({ qr_token: "forged" }));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Invalid QR token" });
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("looks up a typed code case-insensitively", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));

    const res = await POST(post({ qr_token: "Tok-123" }));

    expect(res.status).toBe(200);
    expect(findByQrToken).toHaveBeenCalledWith({}, "tok-123");
  });
});

describe("replay and cancelled tickets", () => {
  it("reports a duplicate instead of checking in twice", async () => {
    findByQrToken.mockResolvedValue(ticket("checked_in"));

    const res = await POST(post({ qr_token: "tok" }));

    await expect(res.json()).resolves.toMatchObject({ status: "duplicate" });
    // The critical assertion: a replayed QR code must not write again.
    expect(updateStatus).not.toHaveBeenCalled();
    expect(sendEmailNotification).not.toHaveBeenCalled();
  });

  it("rejects a cancelled ticket without checking it in", async () => {
    findByQrToken.mockResolvedValue(ticket("cancelled"));

    const res = await POST(post({ qr_token: "tok" }));

    await expect(res.json()).resolves.toEqual({ status: "rejected", reason: "cancelled" });
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("successful check-in", () => {
  it("marks the ticket checked in and attributes it to the facilitator", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));

    const res = await POST(post({ qr_token: "tok" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      status: "success",
      attendee: { full_name: "Jane Doe", email: "jane@example.com" },
    });
    // The ticket's own id, not its payment_id — payment_id is nullable, so a
    // ticket whose payment was removed could never be checked in.
    expect(updateStatus).toHaveBeenCalledWith({}, 42, "checked_in", 7);
  });

  it("notifies the attendee with the event details", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));

    await POST(post({ qr_token: "tok" }));

    expect(sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 5,
        email: "jane@example.com",
        email_type: "check_in_confirmed",
        eventTitle: "Launch Day",
      }),
    );
  });

  it("writes an audit record naming the actor and the ticket", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));

    await POST(post({ qr_token: "tok" }));

    expect(logAuditEvent).toHaveBeenCalledWith(
      {},
      7,
      "checkin.performed",
      "ticket",
      100,
      expect.objectContaining({ event_id: 10 }),
    );
  });

  it("still checks in when the ticket has no attached user", async () => {
    findByQrToken.mockResolvedValue({ ...ticket("issued"), USER: null });

    const res = await POST(post({ qr_token: "tok" }));

    expect(res.status).toBe(200);
    expect(updateStatus).toHaveBeenCalled();
    expect(sendEmailNotification).not.toHaveBeenCalled();
  });
});

describe("write failures", () => {
  it("returns 500 and sends no confirmation when the update fails", async () => {
    findByQrToken.mockResolvedValue(ticket("issued"));
    updateStatus.mockResolvedValue(false);

    const res = await POST(post({ qr_token: "tok" }));

    expect(res.status).toBe(500);
    // An attendee must never be told they are checked in if the write failed.
    expect(sendEmailNotification).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
