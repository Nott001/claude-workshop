import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAuth,
  requireRole,
  list,
  getAttendeeCounts,
  create,
  eventFindById,
  eventUpdate,
  updateField,
  findCourseById,
  logAuditEvent,
  replaceEventAssignments,
  speakerReplaceEventAssignments,
  facilitatorIsAssigned,
} = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  list: vi.fn(),
  getAttendeeCounts: vi.fn(),
  create: vi.fn(),
  eventFindById: vi.fn(),
  eventUpdate: vi.fn(),
  updateField: vi.fn(),
  findCourseById: vi.fn(),
  logAuditEvent: vi.fn(),
  replaceEventAssignments: vi.fn(),
  speakerReplaceEventAssignments: vi.fn(),
  facilitatorIsAssigned: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/db/event.dao", () => ({
  list,
  getAttendeeCounts,
  create,
  findById: eventFindById,
  update: eventUpdate,
  updateField,
}));
vi.mock("@/shared/db/dao/course.dao", () => ({ findCourseById }));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ replaceEventAssignments, isAssigned: facilitatorIsAssigned }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ replaceEventAssignments: speakerReplaceEventAssignments }));

vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));

import { GET, POST } from "@/app/api/events/route";
import { POST as PUBLISH } from "@/app/api/events/[id]/publish/route";
import { PATCH } from "@/app/api/events/[id]/route";

const facilitator = {
  allowed: true,
  error: null,
  user: { id: 9, role: ROLES.FACILITATOR, full_name: "Fay", email: "fay@example.com", profile_image_url: null },
};
const denied = { allowed: false, error: "Forbidden", user: null };

const validEvent = {
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Main Hall",
};

const postEvent = (body: unknown) => new Request("https://app.test/api/events", { method: "POST", body: JSON.stringify(body) });

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(facilitator);
  requireAuth.mockResolvedValue({
    id: 5,
    role: ROLES.ATTENDEE,
    full_name: "Jane",
    email: "jane@example.com",
    profile_image_url: null,
  });
  list.mockResolvedValue({ data: [], total: 0, page: 1, limit: 50 });
  getAttendeeCounts.mockResolvedValue({});
  create.mockResolvedValue({ id: 1, ...validEvent });
  eventFindById.mockResolvedValue({ id: 1, status: "draft" });
  eventUpdate.mockResolvedValue({ id: 1, ...validEvent });
  updateField.mockResolvedValue(true);
  replaceEventAssignments.mockResolvedValue(true);
  speakerReplaceEventAssignments.mockResolvedValue(true);
  facilitatorIsAssigned.mockResolvedValue(true);
});

describe("GET /api/events", () => {
  it("passes the caller's role to the query so listings can be filtered by it", async () => {
    await GET(new Request("https://app.test/api/events"));

    expect(list).toHaveBeenCalledWith({}, { role: ROLES.ATTENDEE, userId: 5, filter: null, search: null, page: 1, limit: 50 });
  });

  it("passes a null role for an anonymous caller rather than failing", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/events"));

    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith({}, { role: null, userId: null, filter: null, search: null, page: 1, limit: 50 });
  });

  it("forwards the filter query parameter", async () => {
    await GET(new Request("https://app.test/api/events?filter=upcoming"));

    expect(list).toHaveBeenCalledWith(
      {},
      { role: ROLES.ATTENDEE, userId: 5, filter: "upcoming", search: null, page: 1, limit: 50 },
    );
  });

  it("forwards the search query parameter", async () => {
    await GET(new Request("https://app.test/api/events?search=COBOL"));

    expect(list).toHaveBeenCalledWith(
      {},
      { role: ROLES.ATTENDEE, userId: 5, filter: null, search: "COBOL", page: 1, limit: 50 },
    );
  });

  it("passes the caller's id so a facilitator is filtered to their own events", async () => {
    requireAuth.mockResolvedValue({
      id: 7,
      role: ROLES.FACILITATOR,
      full_name: "Fay",
      email: "fay@example.com",
      profile_image_url: null,
    });

    await GET(new Request("https://app.test/api/events"));

    expect(list).toHaveBeenCalledWith(
      {},
      { role: ROLES.FACILITATOR, userId: 7, filter: null, search: null, page: 1, limit: 50 },
    );
  });

  it("attaches attendee counts to the rows a staff caller receives", async () => {
    requireAuth.mockResolvedValue({
      id: 7,
      role: ROLES.FACILITATOR,
      full_name: "Fay",
      email: "fay@example.com",
      profile_image_url: null,
    });
    list.mockResolvedValue({
      data: [
        { id: 3, title: "Launch", event_date: "2026-09-01", start_time: "09:00", end_time: "17:00", venue_name: "Main Hall" },
      ],
      total: 1,
      page: 1,
      limit: 50,
    });
    getAttendeeCounts.mockResolvedValue({ 3: 7 });

    const res = await GET(new Request("https://app.test/api/events"));
    const body = await res.json();

    expect(getAttendeeCounts).toHaveBeenCalledWith({}, [3]);
    expect(body.data[0].attendee_count).toBe(7);
  });

  it("does not count tickets for a non-staff caller", async () => {
    list.mockResolvedValue({
      data: [{ id: 3, title: "Launch" }],
      total: 1,
      page: 1,
      limit: 50,
    });

    const res = await GET(new Request("https://app.test/api/events"));

    expect(res.status).toBe(200);
    expect(getAttendeeCounts).not.toHaveBeenCalled();
  });
});

describe("POST /api/events authorization", () => {
  it("refuses a caller who is not a facilitator", async () => {
    requireRole.mockResolvedValue(denied);

    const res = await POST(postEvent(validEvent));

    expect(res.status).toBe(403);
    expect(create).not.toHaveBeenCalled();
  });

  it("requires the admin role specifically", async () => {
    await POST(postEvent(validEvent));
    expect(requireRole).toHaveBeenCalledWith(ROLES.ADMIN);
  });
});

describe("POST /api/events validation", () => {
  it("rejects a body missing required fields without writing", async () => {
    const res = await POST(postEvent({ title: "No date" }));

    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });
});

describe("POST /api/events creation", () => {
  it("always creates as draft, never as published, whatever the body says", async () => {
    await POST(postEvent({ ...validEvent, status: "active" }));

    expect(create).toHaveBeenCalledWith({}, expect.objectContaining({ status: "draft" }));
  });

  it("defaults price and currency when omitted", async () => {
    await POST(postEvent(validEvent));

    expect(create).toHaveBeenCalledWith({}, expect.objectContaining({ price: 0, currency: "PHP" }));
  });

  it("returns 500 when the write fails", async () => {
    create.mockResolvedValue(null);

    const res = await POST(postEvent(validEvent));

    expect(res.status).toBe(500);
  });

  it("records facilitator assignments passed at creation", async () => {
    const res = await POST(postEvent({ ...validEvent, facilitator_ids: [2, 7] }));

    expect(res.status).toBe(201);
    expect(replaceEventAssignments).toHaveBeenCalledWith({}, 1, [2, 7], 9);
    expect(logAuditEvent).toHaveBeenCalledWith({}, 9, "event.created", "event", 1, {
      title: "Launch Day",
      facilitator_ids: [2, 7],
      speaker_profile_ids: undefined,
    });
  });

  it("skips assignment when no facilitator_ids are sent", async () => {
    await POST(postEvent(validEvent));

    expect(replaceEventAssignments).not.toHaveBeenCalled();
    expect(logAuditEvent).toHaveBeenCalledWith({}, 9, "event.created", "event", 1, {
      title: "Launch Day",
      facilitator_ids: undefined,
      speaker_profile_ids: undefined,
    });
  });

  it("returns 500 when the facilitator assignment fails", async () => {
    replaceEventAssignments.mockResolvedValue(false);

    const res = await POST(postEvent({ ...validEvent, facilitator_ids: [2] }));

    expect(res.status).toBe(500);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("records speaker assignments passed at creation", async () => {
    const res = await POST(postEvent({ ...validEvent, speaker_profile_ids: [4, 8] }));

    expect(res.status).toBe(201);
    expect(speakerReplaceEventAssignments).toHaveBeenCalledWith({}, 1, [4, 8]);
    expect(logAuditEvent).toHaveBeenCalledWith({}, 9, "event.created", "event", 1, {
      title: "Launch Day",
      facilitator_ids: undefined,
      speaker_profile_ids: [4, 8],
    });
  });

  it("skips speaker sync when no speaker_profile_ids are sent", async () => {
    await POST(postEvent(validEvent));

    expect(speakerReplaceEventAssignments).not.toHaveBeenCalled();
  });

  it("returns 500 when the speaker assignment fails", async () => {
    speakerReplaceEventAssignments.mockResolvedValue(false);

    const res = await POST(postEvent({ ...validEvent, speaker_profile_ids: [4] }));

    expect(res.status).toBe(500);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("POST /api/events/[id]/publish", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = () => new Request("https://app.test/api/events/1/publish", { method: "POST" });
  const adminUser = {
    id: 9,
    role: ROLES.ADMIN,
    full_name: "Alex",
    email: "alex@example.com",
    profile_image_url: null,
  };
  const facilitatorUser = {
    id: 10,
    role: ROLES.FACILITATOR,
    full_name: "Fay",
    email: "fay@example.com",
    profile_image_url: null,
  };

  beforeEach(() => {
    requireAuth.mockResolvedValue(adminUser);
  });

  it("refuses a caller below admin", async () => {
    requireAuth.mockResolvedValue({ ...adminUser, role: ROLES.ATTENDEE });

    const res = await PUBLISH(req(), params("1"));

    expect(res.status).toBe(403);
    expect(updateField).not.toHaveBeenCalled();
  });

  it("refuses a facilitator even when assigned to the event", async () => {
    requireAuth.mockResolvedValue(facilitatorUser);
    facilitatorIsAssigned.mockResolvedValue(true);

    const res = await PUBLISH(req(), params("1"));

    expect(res.status).toBe(403);
    expect(updateField).not.toHaveBeenCalled();
  });

  it("returns 401 for an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await PUBLISH(req(), params("1"));

    expect(res.status).toBe(401);
    expect(updateField).not.toHaveBeenCalled();
  });

  it("returns 404 for an event that does not exist", async () => {
    eventFindById.mockResolvedValue(null);

    const res = await PUBLISH(req(), params("999"));

    expect(res.status).toBe(404);
    expect(updateField).not.toHaveBeenCalled();
  });

  it("refuses to publish an event that is not a draft", async () => {
    eventFindById.mockResolvedValue({ id: 1, status: "active" });

    const res = await PUBLISH(req(), params("1"));

    expect(res.status).toBe(400);
    // Guards against re-publishing, which would re-fire downstream side effects.
    expect(updateField).not.toHaveBeenCalled();
  });

  it("moves a draft to active and records who published it", async () => {
    const res = await PUBLISH(req(), params("1"));

    expect(res.status).toBe(200);
    expect(updateField).toHaveBeenCalledWith({}, 1, "status", "active");
    expect(logAuditEvent).toHaveBeenCalledWith({}, 9, "event.published", "event", 1);
  });

  it("returns 500 and writes no audit record when the update fails", async () => {
    updateField.mockResolvedValue(false);

    const res = await PUBLISH(req(), params("1"));

    expect(res.status).toBe(500);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/events/[id] edit capability", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const req = (body: unknown) => new Request("https://app.test/api/events/1", { method: "PATCH", body: JSON.stringify(body) });

  it("refuses an assigned facilitator even when they run the event", async () => {
    requireAuth.mockResolvedValue({
      id: 10,
      role: ROLES.FACILITATOR,
      full_name: "Fay",
      email: "fay@example.com",
      profile_image_url: null,
    });
    facilitatorIsAssigned.mockResolvedValue(true);

    const res = await PATCH(req({ title: "Renamed" }), params("1"));

    expect(res.status).toBe(403);
    expect(eventUpdate).not.toHaveBeenCalled();
  });

  it("admits an admin to the update path", async () => {
    requireAuth.mockResolvedValue({
      id: 9,
      role: ROLES.ADMIN,
      full_name: "Alex",
      email: "alex@example.com",
      profile_image_url: null,
    });

    const res = await PATCH(req({ title: "Renamed" }), params("1"));

    expect(res.status).toBe(200);
  });
});
