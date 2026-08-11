import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, courseDao, eventDao, ticketDao, speakerDao } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  courseDao: {
    findCourseWithDetails: vi.fn(),
    userHasCourseAccess: vi.fn(),
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
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/dao/course.dao", () => courseDao);
vi.mock("@/shared/db/dao/ticket.dao", () => ticketDao);
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/modules/events/db/event.dao", () => eventDao);
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

import { GET } from "@/app/api/courses/[courseId]/room/route";

const params = { params: Promise.resolve({ courseId: "4" }) };
const COURSE = {
  id: 4,
  course_name: "Intro",
  course_description: null,
  event_id: 9,
  MODULE: [],
};
const STARTED_EVENT = { id: 9, title: "Demo Day", event_date: "2020-01-01", start_time: "09:00" };
const FUTURE_EVENT = { id: 9, title: "Demo Day", event_date: "2099-01-01", start_time: "09:00" };

function roomRequest() {
  return new Request("https://app.test/api/courses/4/room");
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue({ id: 2, role: ROLES.ATTENDEE });
  courseDao.findCourseWithDetails.mockResolvedValue(COURSE);
  courseDao.userHasCourseAccess.mockResolvedValue(true);
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
    expect(courseDao.userHasCourseAccess).not.toHaveBeenCalled();
  });

  it("refuses an attendee the course gate does not admit", async () => {
    courseDao.userHasCourseAccess.mockResolvedValue(false);

    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(403);
  });

  it("admits staff without asking the access gate, as their access is role-based", async () => {
    requireAuth.mockResolvedValue({ id: 5, role: ROLES.FACILITATOR });

    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(200);
    expect(courseDao.userHasCourseAccess).not.toHaveBeenCalled();
  });

  it("admits a ticket holder whose role is below staff", async () => {
    const res = await GET(roomRequest(), params);

    expect(res.status).toBe(200);
    expect(courseDao.userHasCourseAccess).toHaveBeenCalledWith(expect.anything(), 2, 4);
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
