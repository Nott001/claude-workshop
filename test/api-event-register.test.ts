import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, eventFindById, findActiveTicketByUserAndEvent, findPendingByUserAndEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  eventFindById: vi.fn(),
  findActiveTicketByUserAndEvent: vi.fn(),
  findPendingByUserAndEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/db/event.dao", () => ({ findById: eventFindById }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({ findActiveTicketByUserAndEvent }));
vi.mock("@/shared/db/dao/payment.dao", () => ({ findPendingByUserAndEvent }));

import { GET, POST } from "@/app/api/events/[id]/register/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("https://app.test/api/events/1/register", { method: "POST" });

const attendee = { id: 5, role: ROLES.ATTENDEE, full_name: "Jane Doe", email: "jane@example.com", profile_image_url: null };
const facilitator = { id: 9, role: ROLES.FACILITATOR, full_name: "Fay", email: "fay@example.com", profile_image_url: null };

const published = { id: 1, title: "Launch Day", status: "published" };
const draft = { id: 1, title: "Secret Day", status: "draft" };

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ allowed: true, error: null, user: attendee });
  eventFindById.mockResolvedValue(published);
  findActiveTicketByUserAndEvent.mockResolvedValue(null);
  findPendingByUserAndEvent.mockResolvedValue(null);
});

describe("GET authentication", () => {
  it("returns 401 without a session", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await GET(req(), params("1"));

    expect(res.status).toBe(401);
    expect(eventFindById).not.toHaveBeenCalled();
  });
});

describe("GET draft visibility", () => {
  it("hides a draft event from an attendee behind a 404", async () => {
    eventFindById.mockResolvedValue(draft);

    const res = await GET(req(), params("1"));

    expect(res.status).toBe(404);
    // 404 rather than 403: an attendee should not learn the event exists.
    await expect(res.json()).resolves.toEqual({ error: "Event not found" });
  });

  it("shows a draft event to a facilitator", async () => {
    requireRole.mockResolvedValue({ allowed: true, error: null, user: facilitator });
    eventFindById.mockResolvedValue(draft);

    const res = await GET(req(), params("1"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ event: { status: "draft" } });
  });

  it("returns 404 when the event does not exist", async () => {
    eventFindById.mockResolvedValue(null);

    const res = await GET(req(), params("999"));

    expect(res.status).toBe(404);
  });
});

describe("GET registration state", () => {
  it("reports already_registered when an active ticket exists", async () => {
    findActiveTicketByUserAndEvent.mockResolvedValue({ payment_id: 3 });

    const res = await GET(req(), params("1"));

    await expect(res.json()).resolves.toMatchObject({ already_registered: true });
  });

  it("reports not registered when no active ticket exists", async () => {
    const res = await GET(req(), params("1"));
    await expect(res.json()).resolves.toMatchObject({ already_registered: false });
  });

  it("returns the caller's own identity, not a client-supplied one", async () => {
    const res = await GET(req(), params("1"));

    await expect(res.json()).resolves.toMatchObject({
      user: { user_id: 5, full_name: "Jane Doe", email: "jane@example.com" },
    });
  });
});

describe("POST authentication", () => {
  it("returns 401 without a session and performs no lookup", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await POST(req(), params("1"));

    expect(res.status).toBe(401);
    expect(eventFindById).not.toHaveBeenCalled();
    expect(findActiveTicketByUserAndEvent).not.toHaveBeenCalled();
  });
});

describe("POST input validation", () => {
  it.each(["abc", "-1", "0", ""])("rejects event id %j with 400", async (id) => {
    const res = await POST(req(), params(id));

    expect(res.status).toBe(400);
    expect(eventFindById).not.toHaveBeenCalled();
  });
});

describe("POST duplicate registration", () => {
  it("returns 409 when the user already holds an active ticket", async () => {
    findActiveTicketByUserAndEvent.mockResolvedValue({ payment_id: 3 });

    const res = await POST(req(), params("1"));

    expect(res.status).toBe(409);
    // Must not start a second payment for an event the user already holds.
    expect(findPendingByUserAndEvent).not.toHaveBeenCalled();
  });
});

describe("POST eligibility", () => {
  it("resumes an existing pending payment rather than creating a second", async () => {
    findPendingByUserAndEvent.mockResolvedValue({ id: 77 });

    const res = await POST(req(), params("1"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ eligible: true, pending_payment_id: 77 });
  });

  it("reports plain eligibility when there is nothing pending", async () => {
    const res = await POST(req(), params("1"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ eligible: true });
  });

  it("hides a draft event from an attendee", async () => {
    eventFindById.mockResolvedValue(draft);

    const res = await POST(req(), params("1"));

    expect(res.status).toBe(404);
    expect(findActiveTicketByUserAndEvent).not.toHaveBeenCalled();
  });

  it("scopes the ticket lookup to the caller and the event in the url", async () => {
    await POST(req(), params("1"));

    expect(findActiveTicketByUserAndEvent).toHaveBeenCalledWith({}, 5, 1);
  });
});
