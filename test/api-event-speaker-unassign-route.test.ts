import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, speakerDao, courseDao, logAuditEvent, eventFindById, facilitatorIsAssigned } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  speakerDao: {
    unassignFromEvent: vi.fn(),
  },
  courseDao: {
    clearModuleSpeakerForEvent: vi.fn(),
  },
  logAuditEvent: vi.fn(),
  eventFindById: vi.fn(),
  facilitatorIsAssigned: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/shared/db/dao/course.dao", () => courseDao);
vi.mock("@/modules/events/db/event.dao", () => ({ findById: eventFindById }));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ isAssigned: facilitatorIsAssigned }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));

import { DELETE } from "@/app/api/events/[id]/speakers/[profileId]/route";

const user = (id: number, role: string) => ({
  id,
  role,
  full_name: "Fay",
  email: "fay@example.com",
  profile_image_url: null,
});
const facilitator = user(5, "facilitator");
const attendee = user(6, "attendee");
const params = { params: Promise.resolve({ id: "9", profileId: "7" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(facilitator);
  speakerDao.unassignFromEvent.mockResolvedValue(true);
  courseDao.clearModuleSpeakerForEvent.mockResolvedValue(true);
  logAuditEvent.mockResolvedValue(undefined);
  eventFindById.mockResolvedValue({ id: 9, status: "active" });
  facilitatorIsAssigned.mockResolvedValue(true);
});

describe("DELETE /api/events/[id]/speakers/[profileId]", () => {
  it("clears the module speaker reference when an assigned facilitator unassigns", async () => {
    const res = await DELETE(new Request("https://app.test/api/events/9/speakers/7"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(speakerDao.unassignFromEvent).toHaveBeenCalledWith({}, 9, 7);
    expect(courseDao.clearModuleSpeakerForEvent).toHaveBeenCalledWith({}, 9, 7);
    expect(logAuditEvent).toHaveBeenCalledWith({}, 5, "speaker.unassigned", "speaker_profile", 7, { event_id: 9 });
  });

  it("does not touch modules when the unassign fails", async () => {
    speakerDao.unassignFromEvent.mockResolvedValue(false);

    const res = await DELETE(new Request("https://app.test/api/events/9/speakers/7"), params);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to unassign speaker" });
    expect(courseDao.clearModuleSpeakerForEvent).not.toHaveBeenCalled();
  });

  it("refuses a facilitator who is not assigned to the event", async () => {
    facilitatorIsAssigned.mockResolvedValue(false);

    const res = await DELETE(new Request("https://app.test/api/events/9/speakers/7"), params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    expect(speakerDao.unassignFromEvent).not.toHaveBeenCalled();
    expect(courseDao.clearModuleSpeakerForEvent).not.toHaveBeenCalled();
  });

  it("refuses a caller below facilitator without touching the database", async () => {
    requireAuth.mockResolvedValue(attendee);

    const res = await DELETE(new Request("https://app.test/api/events/9/speakers/7"), params);

    expect(res.status).toBe(403);
    expect(speakerDao.unassignFromEvent).not.toHaveBeenCalled();
    expect(courseDao.clearModuleSpeakerForEvent).not.toHaveBeenCalled();
  });

  it("returns 401 for an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await DELETE(new Request("https://app.test/api/events/9/speakers/7"), params);

    expect(res.status).toBe(401);
    expect(speakerDao.unassignFromEvent).not.toHaveBeenCalled();
  });
});
