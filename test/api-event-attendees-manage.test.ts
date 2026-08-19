import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireRole,
  findById,
  isAssigned,
  isAssignedByUserId,
  getAttendees,
  findActiveTicketWithUser,
  findActiveTicketByUserAndEvent,
  updateStatus,
  sendEmailNotification,
  logAuditEvent,
  generateQRDataUrl,
  getAttendeeSurveyFlags,
  sendSurveyToAttendee,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findById: vi.fn(),
  isAssigned: vi.fn(),
  isAssignedByUserId: vi.fn(),
  getAttendees: vi.fn(),
  findActiveTicketWithUser: vi.fn(),
  findActiveTicketByUserAndEvent: vi.fn(),
  updateStatus: vi.fn(),
  sendEmailNotification: vi.fn(),
  logAuditEvent: vi.fn(),
  generateQRDataUrl: vi.fn(),
  getAttendeeSurveyFlags: vi.fn(async () => ({ usable: true, hasSurvey: true, byUser: new Map() })),
  sendSurveyToAttendee: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/db/event.dao", () => ({ findById }));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ isAssigned }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ isAssignedByUserId }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({
  getAttendees,
  findActiveTicketWithUser,
  findActiveTicketByUserAndEvent,
  updateStatus,
}));
vi.mock("@/modules/surveys/lib/survey-service", () => ({ getAttendeeSurveyFlags, sendSurveyToAttendee }));
vi.mock("@/shared/integrations/email/send-notification", () => ({ sendEmailNotification }));
vi.mock("@/shared/integrations/qr", () => ({ generateQRDataUrl }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));

import { GET as manageGET } from "@/app/api/events/[id]/attendees/manage/route";
import { POST as checkinPOST } from "@/app/api/events/[id]/attendees/[userId]/checkin/route";
import { POST as cancelPOST } from "@/app/api/events/[id]/attendees/[userId]/cancel/route";
import { POST as resendPOST } from "@/app/api/events/[id]/attendees/[userId]/resend-ticket/route";
import { POST as surveyPOST } from "@/app/api/events/[id]/attendees/[userId]/survey/route";

const admin = { id: 1, role: ROLES.ADMIN };

const event = {
  id: 1,
  title: "Launch Day",
  event_date: "2020-01-01",
  start_time: "09:00",
  end_time: "10:00",
  venue_name: "Main Hall",
  venue_address: null,
  description: null,
  price: 0,
  currency: "PHP",
  cover_image_url: null,
  status: "complete",
  survey_enabled: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function liveTicket(status: "issued" | "checked_in" = "issued") {
  return {
    id: 42,
    payment_id: 100,
    user_id: 5,
    event_id: 1,
    qr_token: "qr-abc",
    status,
    USER: { full_name: "Jane Doe", email: "jane@example.com" },
  };
}

const get = (path: string) => new Request(`https://app.test${path}`);
const post = (path: string) => new Request(`https://app.test${path}`, { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ allowed: true, error: null, user: admin });
  findById.mockResolvedValue(event);
  updateStatus.mockResolvedValue(true);
  sendEmailNotification.mockResolvedValue(true);
  generateQRDataUrl.mockResolvedValue("data:image/png;base64,aaa");
});

describe("GET /api/events/[id]/attendees/manage", () => {
  it("requires a session", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await manageGET(get("/api/events/1/attendees/manage"), { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(401);
    expect(getAttendees).not.toHaveBeenCalled();
  });

  it("refuses a facilitator even when assigned to the event", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });
    isAssigned.mockResolvedValue(true);

    const res = await manageGET(get("/api/events/1/attendees/manage"), { params: Promise.resolve({ id: "1" }) });

    expect(res.status).toBe(403);
    expect(getAttendees).not.toHaveBeenCalled();
  });

  it("returns the admin view with action flags for an admin", async () => {
    getAttendees.mockResolvedValue({
      data: [{ USER: { id: 5, full_name: "Jane", email: "j@example.com" }, status: "issued", issued_at: "a", updated_at: "a" }],
      total: 1,
    });
    getAttendeeSurveyFlags.mockResolvedValue({
      usable: true,
      hasSurvey: true,
      byUser: new Map([[5, { sent: true, responded: false }]]),
    });

    const res = await manageGET(get("/api/events/1/attendees/manage?page=1&limit=15"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.attendees).toEqual([
      expect.objectContaining({
        user_id: 5,
        full_name: "Jane",
        email: "j@example.com",
        ticket_status: "issued",
        survey: { sent: true, responded: false },
        can_check_in: true,
        can_send_survey: true,
      }),
    ]);
    expect(body.survey).toEqual({
      opt_in: true,
      finished: true,
      sendable: true,
      status: "open",
    });
  });
});

describe("POST /api/events/[id]/attendees/[userId]/checkin", () => {
  it("requires a session", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await checkinPOST(post("/api/events/1/attendees/5/checkin"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(401);
    expect(findActiveTicketWithUser).not.toHaveBeenCalled();
  });

  it("refuses a facilitator", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await checkinPOST(post("/api/events/1/attendees/5/checkin"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(403);
    expect(findActiveTicketWithUser).not.toHaveBeenCalled();
  });

  it("checks in an issued registration and records who did it", async () => {
    findActiveTicketWithUser.mockResolvedValue(liveTicket("issued"));

    const res = await checkinPOST(post("/api/events/1/attendees/5/checkin"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      status: "checked_in",
      attendee: { full_name: "Jane Doe", email: "jane@example.com" },
    });
    expect(updateStatus).toHaveBeenCalledWith({}, 42, "checked_in", 1);
    expect(logAuditEvent).toHaveBeenCalledWith(
      {},
      1,
      "checkin.performed",
      "ticket",
      100,
      expect.objectContaining({ event_id: 1, attendee_name: "Jane Doe" }),
    );
    expect(sendEmailNotification).toHaveBeenCalledWith(
      expect.objectContaining({ email_type: "check_in_confirmed", eventTitle: "Launch Day" }),
    );
  });

  it("reports an already-checked-in registration without writing again", async () => {
    findActiveTicketWithUser.mockResolvedValue(liveTicket("checked_in"));

    const res = await checkinPOST(post("/api/events/1/attendees/5/checkin"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    await expect(res.json()).resolves.toEqual({ status: "already_checked_in" });
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("returns 404 for a user with no live registration", async () => {
    findActiveTicketWithUser.mockResolvedValue(null);

    const res = await checkinPOST(post("/api/events/1/attendees/5/checkin"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(404);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("POST /api/events/[id]/attendees/[userId]/cancel", () => {
  it("requires a session", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await cancelPOST(post("/api/events/1/attendees/5/cancel"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(401);
  });

  it("cancels an issued registration", async () => {
    findActiveTicketByUserAndEvent.mockResolvedValue({ ...liveTicket("issued"), USER: undefined });

    const res = await cancelPOST(post("/api/events/1/attendees/5/cancel"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "cancelled" });
    expect(updateStatus).toHaveBeenCalledWith({}, 42, "cancelled");
  });

  it("refuses to cancel a checked-in registration", async () => {
    findActiveTicketByUserAndEvent.mockResolvedValue({ ...liveTicket("checked_in"), USER: undefined });

    const res = await cancelPOST(post("/api/events/1/attendees/5/cancel"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(400);
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("POST /api/events/[id]/attendees/[userId]/resend-ticket", () => {
  it("re-sends the ticket email with the QR code", async () => {
    findActiveTicketWithUser.mockResolvedValue(liveTicket("issued"));

    const res = await resendPOST(post("/api/events/1/attendees/5/resend-ticket"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "queued" });
    await vi.waitFor(() => {
      expect(sendEmailNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 5,
          email: "jane@example.com",
          email_type: "ticket_issued",
          eventTitle: "Launch Day",
          eventDate: "2020-01-01",
          code: "qr-abc",
          qrDataUrl: "data:image/png;base64,aaa",
        }),
      );
    });
    expect(generateQRDataUrl).toHaveBeenCalledWith("qr-abc");
  });

  it("requires a session", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await resendPOST(post("/api/events/1/attendees/5/resend-ticket"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(401);
    expect(findActiveTicketWithUser).not.toHaveBeenCalled();
  });
});

describe("POST /api/events/[id]/attendees/[userId]/survey", () => {
  it("sends the survey to the attendee and reports delivery", async () => {
    sendSurveyToAttendee.mockResolvedValue({ ok: true, delivered: true });

    const res = await surveyPOST(post("/api/events/1/attendees/5/survey"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true, delivered: true });
    expect(sendSurveyToAttendee).toHaveBeenCalledWith({}, event, 5);
  });

  it("maps a refusal reason to a human message", async () => {
    sendSurveyToAttendee.mockResolvedValue({ ok: false, reason: "already_responded" });

    const res = await surveyPOST(post("/api/events/1/attendees/5/survey"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "This attendee has already responded" });
  });

  it("requires a session", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await surveyPOST(post("/api/events/1/attendees/5/survey"), {
      params: Promise.resolve({ id: "1", userId: "5" }),
    });

    expect(res.status).toBe(401);
    expect(sendSurveyToAttendee).not.toHaveBeenCalled();
  });
});
