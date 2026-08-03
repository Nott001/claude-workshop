import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, findCourseByEvent, userHasCourseAccess } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findCourseByEvent: vi.fn(),
  userHasCourseAccess: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/dao", () => ({ courseDao: { findCourseByEvent, userHasCourseAccess } }));

import { GET } from "@/app/api/courses/event/[eventId]/route";

const req = () => new Request("https://app.test/api/courses/event/42");
const params = { params: Promise.resolve({ eventId: "42" }) };

const attendee = { id: 5, role: "attendee", full_name: "Jane", email: "jane@example.com" };
const facilitator = { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com" };
const speaker = { id: 7, role: "speaker", full_name: "Sam", email: "sam@example.com" };
const course = { id: 12, course_name: "React", MODULE: [] };

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(attendee);
  findCourseByEvent.mockResolvedValue(course);
  userHasCourseAccess.mockResolvedValue(true);
});

describe("authentication", () => {
  it("refuses an unauthenticated caller without resolving a course", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await GET(req(), params);

    expect(res.status).toBe(401);
    expect(findCourseByEvent).not.toHaveBeenCalled();
  });
});

describe("course resolution", () => {
  it("404s when the event has no course", async () => {
    findCourseByEvent.mockResolvedValue(null);

    const res = await GET(req(), params);

    expect(res.status).toBe(404);
    expect(userHasCourseAccess).not.toHaveBeenCalled();
  });
});

describe("entitlement", () => {
  it("serves the course to an attendee who holds access", async () => {
    const res = await GET(req(), params);

    expect(res.status).toBe(200);
    expect(findCourseByEvent).toHaveBeenCalledWith(expect.anything(), 42);
    expect(userHasCourseAccess).toHaveBeenCalledWith(expect.anything(), 5, 12);
  });

  it("refuses the course to an attendee without access", async () => {
    userHasCourseAccess.mockResolvedValue(false);

    const res = await GET(req(), params);

    expect(res.status).toBe(403);
  });

  it("gives facilitators access without consulting entitlements", async () => {
    requireAuth.mockResolvedValue(facilitator);

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
    expect(userHasCourseAccess).not.toHaveBeenCalled();
  });

  it("checks entitlement for a speaker like any other non-facilitator", async () => {
    requireAuth.mockResolvedValue(speaker);
    userHasCourseAccess.mockResolvedValue(false);

    const res = await GET(req(), params);

    expect(res.status).toBe(403);
    expect(userHasCourseAccess).toHaveBeenCalledWith(expect.anything(), 7, 12);
  });
});
