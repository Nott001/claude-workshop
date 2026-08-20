import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, findCourseByEvent, resolveCourseGrant } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findCourseByEvent: vi.fn(),
  resolveCourseGrant: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/dao/course.dao", () => ({ findCourseByEvent }));
// One gate for every course surface — exercised directly in
// course-entitlement.test.ts, stubbed here so this file stays about the route.
vi.mock("@/modules/courses/lib/course-entitlement", () => ({ resolveCourseGrant }));

import { GET } from "@/app/api/courses/event/[eventId]/route";

const req = () => new Request("https://app.test/api/courses/event/42");
const params = { params: Promise.resolve({ eventId: "42" }) };

const attendee = { id: 5, role: ROLES.ATTENDEE, full_name: "Jane", email: "jane@example.com" };
const facilitator = { id: 9, role: ROLES.FACILITATOR, full_name: "Fay", email: "fay@example.com" };
const speaker = { id: 7, role: ROLES.SPEAKER, full_name: "Sam", email: "sam@example.com" };
const course = { id: 12, course_name: "React", MODULE: [] };

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ allowed: true, error: null, user: attendee });
  findCourseByEvent.mockResolvedValue(course);
  resolveCourseGrant.mockResolvedValue("live");
});

describe("authentication", () => {
  it("refuses an unauthenticated caller without resolving a course", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

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
    expect(resolveCourseGrant).not.toHaveBeenCalled();
  });
});

describe("entitlement", () => {
  it("serves the course to an attendee who holds access", async () => {
    const res = await GET(req(), params);

    expect(res.status).toBe(200);
    expect(findCourseByEvent).toHaveBeenCalledWith(expect.anything(), 42);
    expect(resolveCourseGrant).toHaveBeenCalledWith(expect.anything(), attendee, 12);
  });

  it("refuses the course to an attendee without access", async () => {
    resolveCourseGrant.mockResolvedValue(null);

    const res = await GET(req(), params);

    expect(res.status).toBe(403);
  });

  it("gives facilitators access without consulting entitlements", async () => {
    requireRole.mockResolvedValue({ allowed: true, error: null, user: facilitator });

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
  });

  it("checks entitlement for a speaker like any other non-facilitator", async () => {
    requireRole.mockResolvedValue({ allowed: true, error: null, user: speaker });
    resolveCourseGrant.mockResolvedValue(null);

    const res = await GET(req(), params);

    expect(res.status).toBe(403);
    expect(resolveCourseGrant).toHaveBeenCalledWith(expect.anything(), speaker, 12);
  });

  it("serves a course a finished event unlocked, not only a live one", async () => {
    resolveCourseGrant.mockResolvedValue("after_event");

    const res = await GET(req(), params);

    expect(res.status).toBe(200);
  });
});
