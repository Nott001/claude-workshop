import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, resolveCourseGrant, readAfterEventModules, courseDao, eventDao, ticketDao, speakerDao } = vi.hoisted(
  () => ({
    requireAuth: vi.fn(),
    resolveCourseGrant: vi.fn(),
    readAfterEventModules: vi.fn(),
    courseDao: {
      findCourseWithDetails: vi.fn(),
    },
    eventDao: {
      findByIdWithCourse: vi.fn(),
    },
    ticketDao: {
      findActiveTicketByUserAndEvent: vi.fn(),
    },
    speakerDao: {
      findByUserId: vi.fn(),
      checkSpeakerAssignment: vi.fn(),
    },
  }),
);

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/dao/course.dao", () => courseDao);
// The gate itself is exercised in course-entitlement.test.ts; here the route's
// contract is that it asks that one gate and shapes what comes back.
vi.mock("@/modules/courses/lib/course-entitlement", () => ({ resolveCourseGrant, readAfterEventModules }));
vi.mock("@/shared/db/dao/ticket.dao", () => ticketDao);
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/modules/events/db/event.dao", () => eventDao);
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

import { GET } from "@/app/api/courses/[courseId]/room/route";
import { eventZoneDate } from "@/shared/lib/date-utils";

const params = { params: Promise.resolve({ courseId: "4" }) };
const LIVE_MODULE = { id: 1, module_name: "Session", LESSONS: [] };
const HELD_MODULE = { id: 2, module_name: "Take-home", LESSONS: [] };

// findCourseWithDetails is mocked, so each test gets its own copy: the route
// narrows course.MODULE in place, and a shared literal would carry one test's
// stripping into the next.
const course = () => ({
  id: 4,
  course_name: "Intro",
  course_description: null,
  event_id: 9,
  MODULE: [LIVE_MODULE, HELD_MODULE],
});
const COURSE = course();

const STARTED_EVENT = { id: 9, title: "Demo Day", event_date: "2020-01-01", start_time: "09:00", end_time: "17:00" };
// Open right now on the app zone's calendar: started, not yet finished. Both
// edges have to be real for the release rule to have anything to decide.
const RUNNING_EVENT = { ...STARTED_EVENT, event_date: eventZoneDate(), start_time: "00:00", end_time: "23:59" };
const FUTURE_EVENT = { id: 9, title: "Demo Day", event_date: "2099-01-01", start_time: "09:00", end_time: "17:00" };

function roomRequest() {
  return new Request("https://app.test/api/courses/4/room");
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue({ id: 2, role: ROLES.ATTENDEE });
  courseDao.findCourseWithDetails.mockResolvedValue(course());
  resolveCourseGrant.mockResolvedValue("live");
  readAfterEventModules.mockResolvedValue({ version: 1, releases: {} });
  eventDao.findByIdWithCourse.mockResolvedValue(STARTED_EVENT);
  ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue(null);
  speakerDao.findByUserId.mockResolvedValue(null);
  speakerDao.checkSpeakerAssignment.mockResolvedValue(false);
});

describe("GET /api/courses/[courseId]/room", () => {
  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(401);
    expect(courseDao.findCourseWithDetails).not.toHaveBeenCalled();
  });

  it("answers 404 for a course that does not exist", async () => {
    courseDao.findCourseWithDetails.mockResolvedValue(null);

    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(404);
    expect(resolveCourseGrant).not.toHaveBeenCalled();
  });

  it("refuses an attendee the course gate does not admit", async () => {
    resolveCourseGrant.mockResolvedValue(null);

    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(403);
  });

  it("admits staff, whose grant the gate answers on role alone", async () => {
    requireAuth.mockResolvedValue({ id: 5, role: ROLES.FACILITATOR });
    resolveCourseGrant.mockResolvedValue("staff");

    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(200);
  });

  it("admits a ticket holder whose role is below staff", async () => {
    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(200);
    expect(resolveCourseGrant).toHaveBeenCalledWith(expect.anything(), { id: 2, role: ROLES.ATTENDEE }, 4);
  });

  it("keeps a held-back module out of the room while the event is still running", async () => {
    // Withheld at the feed, not in the page: material hidden by a component
    // is still on the wire.
    eventDao.findByIdWithCourse.mockResolvedValue(RUNNING_EVENT);
    readAfterEventModules.mockResolvedValue({ version: 1, releases: { "9": [HELD_MODULE.id] } });

    const body = (await (await GET(roomRequest(), params)).json()) as { course: { MODULE: { id: number }[] } };

    expect(body.course.MODULE.map((mod) => mod.id)).toEqual([LIVE_MODULE.id]);
  });

  it("serves it once the event has finished", async () => {
    readAfterEventModules.mockResolvedValue({ version: 1, releases: { "9": [HELD_MODULE.id] } });

    const body = (await (await GET(roomRequest(), params)).json()) as { course: { MODULE: { id: number }[] } };

    expect(body.course.MODULE.map((mod) => mod.id)).toEqual([LIVE_MODULE.id, HELD_MODULE.id]);
  });

  it("shows staff the held-back module throughout, since they built it", async () => {
    requireAuth.mockResolvedValue({ id: 5, role: ROLES.FACILITATOR });
    resolveCourseGrant.mockResolvedValue("staff");
    eventDao.findByIdWithCourse.mockResolvedValue(RUNNING_EVENT);
    readAfterEventModules.mockResolvedValue({ version: 1, releases: { "9": [HELD_MODULE.id] } });

    const body = (await (await GET(roomRequest(), params)).json()) as { course: { MODULE: { id: number }[] } };

    expect(body.course.MODULE).toHaveLength(2);
  });

  it("shows an assigned speaker the same, as they run the session", async () => {
    eventDao.findByIdWithCourse.mockResolvedValue(RUNNING_EVENT);
    speakerDao.findByUserId.mockResolvedValue({ id: 22, user_id: 2 });
    speakerDao.checkSpeakerAssignment.mockResolvedValue(true);
    readAfterEventModules.mockResolvedValue({ version: 1, releases: { "9": [HELD_MODULE.id] } });

    const body = (await (await GET(roomRequest(), params)).json()) as { course: { MODULE: { id: number }[] } };

    expect(body.course.MODULE).toHaveLength(2);
  });

  it("serves the course alongside its event", async () => {
    const res = await GET(roomRequest(), params);

    await expect(res.json()).resolves.toEqual({
      course: COURSE,
      event: STARTED_EVENT,
      hasTicket: false,
      isSpeakerAssigned: false,
      speakerProfileId: null,
    });
    expect(eventDao.findByIdWithCourse).toHaveBeenCalledWith(expect.anything(), 9);
  });

  it("withholds the course from an attendee until the event starts", async () => {
    eventDao.findByIdWithCourse.mockResolvedValue(FUTURE_EVENT);

    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      course: null,
      event: FUTURE_EVENT,
      hasTicket: false,
      isSpeakerAssigned: false,
      speakerProfileId: null,
    });
  });

  it("still serves the course to staff before the event starts, so they can set the room up", async () => {
    requireAuth.mockResolvedValue({ id: 5, role: ROLES.FACILITATOR });
    resolveCourseGrant.mockResolvedValue("staff");
    eventDao.findByIdWithCourse.mockResolvedValue(FUTURE_EVENT);

    const res = await GET(roomRequest(), params);

    await expect(res.json()).resolves.toEqual({
      course: COURSE,
      event: FUTURE_EVENT,
      hasTicket: false,
      isSpeakerAssigned: false,
      speakerProfileId: null,
    });
  });

  it("still serves the course to an assigned speaker before the event starts", async () => {
    eventDao.findByIdWithCourse.mockResolvedValue(FUTURE_EVENT);
    speakerDao.findByUserId.mockResolvedValue({ id: 22, user_id: 2 });
    speakerDao.checkSpeakerAssignment.mockResolvedValue(true);

    const res = await GET(roomRequest(), params);

    await expect(res.json()).resolves.toEqual(expect.objectContaining({ course: COURSE, isSpeakerAssigned: true }));
  });

  it("derives the ticket and speaker facts against the linked event", async () => {
    ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue({ id: 11, event_id: 9, status: "issued" });
    speakerDao.findByUserId.mockResolvedValue({ id: 22, user_id: 2 });
    speakerDao.checkSpeakerAssignment.mockResolvedValue(true);

    const res = await GET(roomRequest(), params);

    expect(ticketDao.findActiveTicketByUserAndEvent).toHaveBeenCalledWith(expect.anything(), 2, 9);
    expect(speakerDao.findByUserId).toHaveBeenCalledWith(expect.anything(), 2);
    expect(speakerDao.checkSpeakerAssignment).toHaveBeenCalledWith(expect.anything(), 22, 9);
    await expect(res.json()).resolves.toEqual(
      expect.objectContaining({ hasTicket: true, isSpeakerAssigned: true, speakerProfileId: 22 }),
    );
  });

  it("reports no assignment for an event without speakers", async () => {
    eventDao.findByIdWithCourse.mockResolvedValue(null);

    const res = await GET(roomRequest(), params);

    expect(ticketDao.findActiveTicketByUserAndEvent).not.toHaveBeenCalled();
    await expect(res.json()).resolves.toEqual({
      course: COURSE,
      event: null,
      hasTicket: false,
      isSpeakerAssigned: false,
      speakerProfileId: null,
    });
  });
});
