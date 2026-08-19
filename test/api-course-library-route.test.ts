import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, listReleasedCourses, resolveCourseGrant, readAfterEventModules, findCourseWithDetails } = vi.hoisted(
  () => ({
    requireAuth: vi.fn(),
    listReleasedCourses: vi.fn(),
    resolveCourseGrant: vi.fn(),
    readAfterEventModules: vi.fn(),
    findCourseWithDetails: vi.fn(),
  }),
);

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/courses/lib/course-entitlement", () => ({
  listReleasedCourses,
  resolveCourseGrant,
  readAfterEventModules,
}));
vi.mock("@/shared/db/dao/course.dao", () => ({ findCourseWithDetails }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

import { GET as libraryGET } from "@/app/api/courses/library/route";
import { GET as contentGET } from "@/app/api/courses/[courseId]/content/route";
import { eventZoneDate } from "@/shared/lib/date-utils";

const contentParams = { params: Promise.resolve({ courseId: "4" }) };
const contentRequest = () => new Request("https://app.test/api/courses/4/content");

const LIVE_MODULE = { id: 1, module_name: "Session", LESSONS: [] };
const HELD_MODULE = { id: 2, module_name: "Take-home", LESSONS: [] };
const FINISHED_EVENT = { id: 9, title: "Demo Day", event_date: "2020-01-01", start_time: "09:00", end_time: "17:00" };
// Started and still open on the app zone's calendar.
const RUNNING_EVENT = { ...FINISHED_EVENT, event_date: eventZoneDate(), start_time: "00:00", end_time: "23:59" };

const course = (event: unknown = FINISHED_EVENT) => ({
  id: 4,
  course_name: "Rust",
  event_id: 9,
  MODULE: [LIVE_MODULE, HELD_MODULE],
  EVENT: event,
});

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue({ id: 5, role: ROLES.ATTENDEE });
  listReleasedCourses.mockResolvedValue([{ id: 4 }]);
  resolveCourseGrant.mockResolvedValue("live");
  readAfterEventModules.mockResolvedValue({ version: 1, releases: { "9": [HELD_MODULE.id] } });
  findCourseWithDetails.mockResolvedValue(course());
});

describe("GET /api/courses/library", () => {
  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    expect((await libraryGET()).status).toBe(401);
    expect(listReleasedCourses).not.toHaveBeenCalled();
  });

  it("answers for the session's own user and nobody else", async () => {
    const res = await libraryGET();

    await expect(res.json()).resolves.toEqual({ courses: [{ id: 4 }] });
    expect(listReleasedCourses).toHaveBeenCalledWith(expect.anything(), 5);
  });
});

describe("GET /api/courses/[courseId]/content", () => {
  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    expect((await contentGET(contentRequest(), contentParams)).status).toBe(401);
  });

  it("404s a course that does not exist, without asking the gate", async () => {
    findCourseWithDetails.mockResolvedValue(null);

    expect((await contentGET(contentRequest(), contentParams)).status).toBe(404);
    expect(resolveCourseGrant).not.toHaveBeenCalled();
  });

  it("refuses a course the gate does not grant", async () => {
    resolveCourseGrant.mockResolvedValue(null);

    expect((await contentGET(contentRequest(), contentParams)).status).toBe(403);
  });

  it("serves the released material once the event has finished", async () => {
    const body = (await (await contentGET(contentRequest(), contentParams)).json()) as {
      course: { MODULE: { id: number }[] };
      released_module_ids: number[];
    };

    expect(body.course.MODULE.map((mod) => mod.id)).toEqual([LIVE_MODULE.id, HELD_MODULE.id]);
    // The page badges what was held back, so it has to be told which.
    expect(body.released_module_ids).toEqual([HELD_MODULE.id]);
  });

  it("still withholds it while the event is running", async () => {
    findCourseWithDetails.mockResolvedValue(course(RUNNING_EVENT));

    const body = (await (await contentGET(contentRequest(), contentParams)).json()) as {
      course: { MODULE: { id: number }[] };
    };

    expect(body.course.MODULE.map((mod) => mod.id)).toEqual([LIVE_MODULE.id]);
  });

  it("shows staff the whole curriculum regardless of the window", async () => {
    resolveCourseGrant.mockResolvedValue("staff");
    findCourseWithDetails.mockResolvedValue(course(RUNNING_EVENT));

    const body = (await (await contentGET(contentRequest(), contentParams)).json()) as {
      course: { MODULE: { id: number }[] };
    };

    expect(body.course.MODULE).toHaveLength(2);
  });

  it("shows nothing to an attendee whose event has not opened", async () => {
    findCourseWithDetails.mockResolvedValue(course({ ...FINISHED_EVENT, event_date: "2099-01-01" }));

    const body = (await (await contentGET(contentRequest(), contentParams)).json()) as {
      course: { MODULE: { id: number }[] };
    };

    expect(body.course.MODULE).toEqual([]);
  });
});
