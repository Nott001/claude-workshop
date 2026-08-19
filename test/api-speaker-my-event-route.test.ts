import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, findByUserId, checkSpeakerAssignment, findByIdWithCourseName, countByEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findByUserId: vi.fn(),
  checkSpeakerAssignment: vi.fn(),
  findByIdWithCourseName: vi.fn(),
  countByEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ findByUserId, checkSpeakerAssignment }));
vi.mock("@/modules/events/db/event.dao", () => ({ findByIdWithCourseName }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({ countByEvent }));

import { GET } from "@/app/api/speakers/me/events/[eventId]/route";

const speaker = { allowed: true, error: null, user: { id: 5, role: ROLES.SPEAKER } };
const profile = { id: 7, user_id: 5, bio: null, photo_url: null, designation: null };
const event = {
  id: 9,
  title: "Launch Day",
  event_date: "2026-08-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Main Hall",
  status: "active",
  COURSE: { id: 3, course_name: "Kickoff" },
  description: "The big day",
};
const params = { params: Promise.resolve({ eventId: "9" }) };

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(speaker);
  findByUserId.mockResolvedValue(profile);
  checkSpeakerAssignment.mockResolvedValue(true);
  findByIdWithCourseName.mockResolvedValue(event);
  countByEvent.mockResolvedValue(42);
});

describe("GET /api/speakers/me/events/[eventId]", () => {
  it("refuses a caller with no session before any lookups", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await GET(new Request("https://app.test/api/speakers/me/events/9"), params);

    expect(res.status).toBe(401);
    expect(findByUserId).not.toHaveBeenCalled();
  });

  it("refuses a signed-in non-speaker with the domain 403", async () => {
    requireRole.mockResolvedValue({ allowed: true, error: null, user: { id: 5, role: ROLES.ATTENDEE } });
    findByUserId.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/speakers/me/events/9"), params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Not a speaker" });
    expect(checkSpeakerAssignment).not.toHaveBeenCalled();
  });

  it("refuses a speaker who is not assigned to the event", async () => {
    checkSpeakerAssignment.mockResolvedValue(false);

    const res = await GET(new Request("https://app.test/api/speakers/me/events/9"), params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Not assigned to this event" });
    expect(findByIdWithCourseName).not.toHaveBeenCalled();
  });

  it("returns 404 for an event that does not exist", async () => {
    findByIdWithCourseName.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/speakers/me/events/9"), params);

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Event not found" });
  });

  it("serves the assigned speaker their event with the attendee count", async () => {
    const res = await GET(new Request("https://app.test/api/speakers/me/events/9"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      event_id: 9,
      title: "Launch Day",
      event_date: "2026-08-01",
      start_time: "09:00",
      end_time: "17:00",
      venue_name: "Main Hall",
      status: "active",
      course_id: 3,
      course_name: "Kickoff",
      description: "The big day",
      attendee_count: 42,
    });
    expect(checkSpeakerAssignment).toHaveBeenCalledWith({}, 7, 9);
    expect(findByIdWithCourseName).toHaveBeenCalledWith({}, 9);
    expect(countByEvent).toHaveBeenCalledWith({}, 9);
  });
});
