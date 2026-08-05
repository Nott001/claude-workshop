import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAuth,
  requireRole,
  list,
  create,
  eventFindById,
  updateField,
  findCourseById,
  logAuditEvent,
  replaceEventAssignments,
  speakerReplaceEventAssignments,
} = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  eventFindById: vi.fn(),
  updateField: vi.fn(),
  findCourseById: vi.fn(),
  logAuditEvent: vi.fn(),
  replaceEventAssignments: vi.fn(),
  speakerReplaceEventAssignments: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao", () => ({
  eventDao: { list, create, findById: eventFindById, updateField },
  courseDao: { findCourseById },
  facilitatorDao: { replaceEventAssignments },
  speakerDao: { replaceEventAssignments: speakerReplaceEventAssignments },
}));
vi.mock("@/modules/audit", () => ({ logAuditEvent }));

import { GET, POST } from "@/app/api/events/route";
import { POST as PUBLISH } from "@/app/api/events/[id]/publish/route";

const facilitator = {
  allowed: true,
  error: null,
  user: { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com", profile_image_url: null },
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
    role: "attendee",
    full_name: "Jane",
    email: "jane@example.com",
    profile_image_url: null,
  });
  list.mockResolvedValue([]);
  create.mockResolvedValue({ id: 1, ...validEvent });
  eventFindById.mockResolvedValue({ id: 1, status: "draft" });
  updateField.mockResolvedValue(true);
  replaceEventAssignments.mockResolvedValue(true);
  speakerReplaceEventAssignments.mockResolvedValue(true);
});

describe("GET /api/events", () => {
  it("passes the caller's role to the query so listings can be filtered by it", async () => {
    await GET(new Request("https://app.test/api/events"));

    expect(list).toHaveBeenCalledWith({}, { role: "attendee", filter: null });
  });

  it("passes a null role for an anonymous caller rather than failing", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/events"));

    expect(res.status).toBe(200);
    expect(list).toHaveBeenCalledWith({}, { role: null, filter: null });
  });

  it("forwards the filter query parameter", async () => {
    await GET(new Request("https://app.test/api/events?filter=upcoming"));

    expect(list).toHaveBeenCalledWith({}, { role: "attendee", filter: "upcoming" });
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
    expect(requireRole).toHaveBeenCalledWith("admin");
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

  it("refuses a caller who is not a facilitator", async () => {
    requireRole.mockResolvedValue(denied);

    const res = await PUBLISH(req(), params("1"));

    expect(res.status).toBe(403);
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
