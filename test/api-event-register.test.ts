import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, eventFindById, findActiveByUserAndEvent, findPendingByUserAndEvent } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  eventFindById: vi.fn(),
  findActiveByUserAndEvent: vi.fn(),
  findPendingByUserAndEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao", () => ({
  eventDao: { findById: eventFindById },
  ticketDao: { findActiveByUserAndEvent },
  paymentDao: { findPendingByUserAndEvent },
}));

import { GET, POST } from "@/app/api/events/[id]/register/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const req = () => new Request("https://app.test/api/events/1/register", { method: "POST" });

const attendee = { id: 5, role: "attendee", full_name: "Jane Doe", email: "jane@example.com" };
const facilitator = { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com" };

const published = { id: 1, title: "Launch Day", status: "published" };
const draft = { id: 1, title: "Secret Day", status: "draft" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(attendee);
  eventFindById.mockResolvedValue(published);
  findActiveByUserAndEvent.mockResolvedValue([]);
  findPendingByUserAndEvent.mockResolvedValue(null);
});

describe("GET authentication", () => {
  it("returns 401 without a session", async () => {
    requireAuth.mockResolvedValue(null);

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
    requireAuth.mockResolvedValue(facilitator);
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
    findActiveByUserAndEvent.mockResolvedValue([{ payment_id: 3 }]);

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
    requireAuth.mockResolvedValue(null);

    const res = await POST(req(), params("1"));

    expect(res.status).toBe(401);
    expect(eventFindById).not.toHaveBeenCalled();
    expect(findActiveByUserAndEvent).not.toHaveBeenCalled();
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
    findActiveByUserAndEvent.mockResolvedValue([{ payment_id: 3 }]);

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
    expect(findActiveByUserAndEvent).not.toHaveBeenCalled();
  });

  it("scopes the ticket lookup to the caller and the event in the url", async () => {
    await POST(req(), params("1"));

    expect(findActiveByUserAndEvent).toHaveBeenCalledWith({}, 5, 1);
  });
});
