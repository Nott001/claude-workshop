import { ROLES } from "@/shared/lib/roles";
import { SOLD_OUT_MESSAGE } from "@/shared/lib/event-capacity";
import type { Event } from "@/shared/types";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  eventDao,
  facilitatorDao,
  speakerDao,
  courseDao,
  ticketDao,
  paymentDao,
  listStorageFolder,
  deleteFromStorage,
  logAuditEvent,
  requireAuditEvent,
  getAttendeeSurveyFlags,
} = vi.hoisted(() => ({
  eventDao: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdWithCourse: vi.fn(),
    getAttendeeCount: vi.fn(),
    getAttendeeCounts: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    updateField: vi.fn(),
    remove: vi.fn(),
  },
  facilitatorDao: { replaceEventAssignments: vi.fn(), isAssigned: vi.fn() },
  speakerDao: { replaceEventAssignments: vi.fn(), isAssignedByUserId: vi.fn() },
  courseDao: {
    findModulesByCourse: vi.fn(),
    findLessonsByModule: vi.fn(),
    findCourseIdByEventId: vi.fn(),
  },
  ticketDao: { findActiveTicketByUserAndEvent: vi.fn(), getAttendees: vi.fn() },
  paymentDao: { findPendingByUserAndEvent: vi.fn() },
  listStorageFolder: vi.fn(),
  deleteFromStorage: vi.fn(),
  logAuditEvent: vi.fn(),
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
  getAttendeeSurveyFlags: vi.fn(async () => ({ usable: true, hasSurvey: true, byUser: new Map() })),
}));

vi.mock("@/modules/events/db/event.dao", () => eventDao);
vi.mock("@/shared/db/dao/facilitator.dao", () => facilitatorDao);
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/shared/db/dao/course.dao", () => courseDao);
vi.mock("@/shared/db/dao/ticket.dao", () => ticketDao);
vi.mock("@/shared/db/dao/payment.dao", () => paymentDao);
vi.mock("@/shared/integrations/storage/service", () => ({ listStorageFolder, deleteFromStorage }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent, requireAuditEvent }));
vi.mock("@/modules/surveys/lib/survey-service", () => ({ getAttendeeSurveyFlags }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

import { getServiceClient } from "@/shared/db/client";
import {
  canManageEvent,
  createEvent,
  deleteEvent,
  EventServiceError,
  getEvent,
  getEventRegistrationState,
  listAdminEventAttendees,
  listEventAttendees,
  listEvents,
  loadEventOr403,
  publishEvent,
  registerForEvent,
  setMeetingLink,
  updateEvent,
} from "@/modules/events/lib/event-service";

const supabase = getServiceClient() as Parameters<typeof createEvent>[0];
const actor = { id: 9 };

const validEvent = {
  title: "Launch Day",
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "17:00",
  venue_name: "Main Hall",
};

beforeEach(() => {
  vi.clearAllMocks();
  eventDao.create.mockResolvedValue({ id: 1, title: "Launch Day", status: "draft" });
  eventDao.findById.mockResolvedValue({ id: 1, title: "Launch Day", status: "draft" });
  eventDao.findByIdWithCourse.mockResolvedValue({ id: 1, status: "active", EVENT_FACILITATOR: [], EVENT_SPEAKER: [] });
  eventDao.getAttendeeCount.mockResolvedValue(3);
  eventDao.getAttendeeCounts.mockResolvedValue({});
  eventDao.update.mockResolvedValue({ id: 1, title: "Launch Day", status: "active" });
  eventDao.updateField.mockResolvedValue(true);
  eventDao.remove.mockResolvedValue(true);
  facilitatorDao.replaceEventAssignments.mockResolvedValue(true);
  facilitatorDao.isAssigned.mockResolvedValue(true);
  speakerDao.replaceEventAssignments.mockResolvedValue(true);
  speakerDao.isAssignedByUserId.mockResolvedValue(true);
  listStorageFolder.mockImplementation(async (bucket: string, folder: string) => [`${folder}/${bucket}-file`]);
  deleteFromStorage.mockResolvedValue(undefined);
  logAuditEvent.mockResolvedValue(undefined);
});

describe("EventServiceError", () => {
  it("carries the status the HTTP layer should answer with", () => {
    const err = new EventServiceError(409, "already registered");

    expect(err.status).toBe(409);
    expect(err.message).toBe("already registered");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("canManageEvent", () => {
  it("admits an admin without consulting assignments", async () => {
    expect(await canManageEvent(supabase, { id: 1, role: ROLES.ADMIN }, 5)).toBe(true);
    expect(await canManageEvent(supabase, { id: 1, role: ROLES.SUPER_ADMIN }, 5)).toBe(true);
    expect(facilitatorDao.isAssigned).not.toHaveBeenCalled();
    expect(speakerDao.isAssignedByUserId).not.toHaveBeenCalled();
  });

  it("admits a facilitator assigned to the event", async () => {
    facilitatorDao.isAssigned.mockResolvedValue(true);

    expect(await canManageEvent(supabase, { id: 7, role: ROLES.FACILITATOR }, 5)).toBe(true);
    expect(facilitatorDao.isAssigned).toHaveBeenCalledWith(supabase, 5, 7);
  });

  it("admits a speaker assigned to the event", async () => {
    speakerDao.isAssignedByUserId.mockResolvedValue(true);

    expect(await canManageEvent(supabase, { id: 8, role: ROLES.SPEAKER }, 5)).toBe(true);
    expect(speakerDao.isAssignedByUserId).toHaveBeenCalledWith(supabase, 8, 5);
  });

  it("denies an unassigned facilitator, an unassigned speaker, and an attendee", async () => {
    facilitatorDao.isAssigned.mockResolvedValue(false);
    speakerDao.isAssignedByUserId.mockResolvedValue(false);

    expect(await canManageEvent(supabase, { id: 7, role: ROLES.FACILITATOR }, 5)).toBe(false);
    expect(await canManageEvent(supabase, { id: 8, role: ROLES.SPEAKER }, 5)).toBe(false);
    expect(await canManageEvent(supabase, { id: 5, role: ROLES.ATTENDEE }, 5)).toBe(false);
    expect(facilitatorDao.isAssigned).toHaveBeenCalledWith(supabase, 5, 7);
    expect(speakerDao.isAssignedByUserId).toHaveBeenCalledWith(supabase, 8, 5);
  });
});

describe("loadEventOr403", () => {
  beforeEach(() => {
    eventDao.findById.mockResolvedValue({ id: 1, title: "Launch Day", status: "draft" });
    facilitatorDao.isAssigned.mockResolvedValue(true);
  });

  it("throws 404 when the event does not exist", async () => {
    eventDao.findById.mockResolvedValue(null);

    await expect(loadEventOr403(supabase, 99, { id: 1, role: ROLES.ADMIN }, "edit")).rejects.toMatchObject({
      status: 404,
      message: "Event not found",
    });
  });

  it("admits an admin for every capability without checking assignments", async () => {
    for (const capability of [
      "edit",
      "delete",
      "publish",
      "attendees",
      "attendees_manage",
      "survey",
      "meeting_link",
    ] as const) {
      await expect(loadEventOr403(supabase, 1, { id: 1, role: ROLES.ADMIN }, capability)).resolves.toMatchObject({ id: 1 });
    }
    expect(facilitatorDao.isAssigned).not.toHaveBeenCalled();
  });

  it("admits a super_admin for delete", async () => {
    await expect(loadEventOr403(supabase, 1, { id: 1, role: ROLES.SUPER_ADMIN }, "delete")).resolves.toMatchObject({ id: 1 });
  });

  it("admits an assigned facilitator only for the attendee read and the meeting link", async () => {
    for (const capability of ["edit", "publish", "attendees_manage", "survey"] as const) {
      await expect(loadEventOr403(supabase, 1, { id: 7, role: ROLES.FACILITATOR }, capability)).rejects.toMatchObject({
        status: 403,
        message: "Forbidden",
      });
    }
    for (const capability of ["attendees", "meeting_link"] as const) {
      await expect(loadEventOr403(supabase, 1, { id: 7, role: ROLES.FACILITATOR }, capability)).resolves.toMatchObject({
        id: 1,
      });
    }
    expect(facilitatorDao.isAssigned).toHaveBeenCalled();
  });

  it("scopes the meeting link to the facilitator's own events", async () => {
    // The link is the one event column a facilitator may write, and only for
    // the event they are actually running.
    facilitatorDao.isAssigned.mockResolvedValue(false);

    await expect(loadEventOr403(supabase, 1, { id: 7, role: ROLES.FACILITATOR }, "meeting_link")).rejects.toMatchObject({
      status: 403,
      message: "Forbidden",
    });
  });

  it("refuses the meeting link to a speaker and an attendee", async () => {
    for (const role of [ROLES.SPEAKER, ROLES.ATTENDEE] as const) {
      await expect(loadEventOr403(supabase, 1, { id: 7, role }, "meeting_link")).rejects.toMatchObject({
        status: 403,
        message: "Forbidden",
      });
    }
  });

  it("throws 403 for an unassigned facilitator", async () => {
    facilitatorDao.isAssigned.mockResolvedValue(false);

    await expect(loadEventOr403(supabase, 1, { id: 7, role: ROLES.FACILITATOR }, "edit")).rejects.toMatchObject({
      status: 403,
      message: "Forbidden",
    });
  });

  it("refuses a facilitator even when assigned for delete", async () => {
    await expect(loadEventOr403(supabase, 1, { id: 7, role: ROLES.FACILITATOR }, "delete")).rejects.toMatchObject({
      status: 403,
      message: "Forbidden",
    });
  });

  it("throws 403 for an attendee", async () => {
    await expect(loadEventOr403(supabase, 1, { id: 5, role: ROLES.ATTENDEE }, "attendees")).rejects.toMatchObject({
      status: 403,
      message: "Forbidden",
    });
  });
});

describe("createEvent", () => {
  it("creates as draft, wires assignments, and audits", async () => {
    const result = await createEvent(supabase, { ...validEvent, facilitator_ids: [2], speaker_profile_ids: [4] }, actor);

    expect(eventDao.create).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ status: "draft", price: 0, currency: "PHP" }),
    );
    expect(facilitatorDao.replaceEventAssignments).toHaveBeenCalledWith(supabase, 1, [2], 9);
    expect(speakerDao.replaceEventAssignments).toHaveBeenCalledWith(supabase, 1, [4]);
    expect(logAuditEvent).toHaveBeenCalledWith(supabase, 9, "event.created", "event", 1, {
      title: "Launch Day",
      facilitator_ids: [2],
      speaker_profile_ids: [4],
    });
    expect(result).toEqual({ id: 1, title: "Launch Day", status: "draft" });
  });

  it("stores the capacity an admin set", async () => {
    await createEvent(supabase, { ...validEvent, capacity: 40 }, actor);

    expect(eventDao.create).toHaveBeenCalledWith(supabase, expect.objectContaining({ capacity: 40 }));
  });

  it("stores an uncapped event as a null capacity, not as an absent column", async () => {
    await createEvent(supabase, { ...validEvent }, actor);

    expect(eventDao.create).toHaveBeenCalledWith(supabase, expect.objectContaining({ capacity: null }));
  });

  it("defaults a new event to onsite when the caller names no mode", async () => {
    await createEvent(supabase, { ...validEvent }, actor);

    expect(eventDao.create).toHaveBeenCalledWith(supabase, expect.objectContaining({ event_type: "onsite" }));
  });

  it("stores an online event as such", async () => {
    await createEvent(supabase, { ...validEvent, event_type: "online", venue_name: "Zoom" }, actor);

    expect(eventDao.create).toHaveBeenCalledWith(supabase, expect.objectContaining({ event_type: "online" }));
  });

  it("throws the write-failure error rather than returning null", async () => {
    eventDao.create.mockResolvedValue(null);

    await expect(createEvent(supabase, { ...validEvent }, actor)).rejects.toMatchObject({
      status: 500,
      message: "Failed to create event",
    });
  });

  it("throws when the facilitator assignment fails and never audits", async () => {
    facilitatorDao.replaceEventAssignments.mockResolvedValue(false);

    await expect(createEvent(supabase, { ...validEvent, facilitator_ids: [2] }, actor)).rejects.toMatchObject({
      status: 500,
      message: "Failed to assign facilitators",
    });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("getEvent", () => {
  it("enriches the detail for staff with counts and join ids", async () => {
    eventDao.findByIdWithCourse.mockResolvedValue({
      id: 1,
      status: "active",
      EVENT_FACILITATOR: [{ user_id: 9 }],
      EVENT_SPEAKER: [{ speaker_profile_id: 4 }],
    });

    const result = await getEvent(supabase, 1, { id: 9, role: ROLES.FACILITATOR });

    expect(facilitatorDao.isAssigned).toHaveBeenCalledWith(supabase, 1, 9);
    expect(result).toMatchObject({ attendee_count: 3, facilitator_ids: [9], speaker_profile_ids: [4] });
  });

  it("serves the remaining seats of a capped event to a signed-out reader", async () => {
    eventDao.findByIdWithCourse.mockResolvedValue({ id: 1, status: "active", capacity: 10, EVENT_SPEAKER: [] });

    const result = await getEvent(supabase, 1, { id: null, role: null });

    // Seats left, not the attendee count: how full an event is stays staff-only.
    expect(result).toMatchObject({ seats_left: 7 });
    expect(result).not.toHaveProperty("attendee_count");
  });

  it("counts no tickets at all for an uncapped event a reader opens", async () => {
    const result = await getEvent(supabase, 1, { id: null, role: null });

    expect(eventDao.getAttendeeCount).not.toHaveBeenCalled();
    expect(result).toMatchObject({ seats_left: null });
  });

  it("reuses the staff attendee count for the seat remainder", async () => {
    eventDao.findByIdWithCourse.mockResolvedValue({
      id: 1,
      status: "active",
      capacity: 4,
      EVENT_FACILITATOR: [],
      EVENT_SPEAKER: [],
    });

    const result = await getEvent(supabase, 1, { id: 9, role: ROLES.ADMIN });

    expect(eventDao.getAttendeeCount).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ attendee_count: 3, seats_left: 1 });
  });

  it("hides an event a facilitator is not assigned to", async () => {
    facilitatorDao.isAssigned.mockResolvedValue(false);

    await expect(getEvent(supabase, 1, { id: 9, role: ROLES.FACILITATOR })).rejects.toMatchObject({
      status: 404,
      message: "Event not found",
    });
  });

  it("does not consult the assignment roster for an admin", async () => {
    await getEvent(supabase, 1, { id: 9, role: ROLES.ADMIN });

    expect(facilitatorDao.isAssigned).not.toHaveBeenCalled();
  });
});

describe("updateEvent", () => {
  const stored = { id: 3, title: "Launch", event_date: "2026-09-01", start_time: "09:00", end_time: "17:00" };

  it("throws a 400 when one end of the range is moved past the stored other end", async () => {
    eventDao.findById.mockResolvedValue(stored);

    await expect(updateEvent(supabase, 3, { end_time: "08:00" }, actor)).rejects.toMatchObject({
      status: 400,
      message: "start_time must be before end_time",
    });
    expect(eventDao.update).not.toHaveBeenCalled();
  });

  it("keeps the stored range out of the event update when only rosters change", async () => {
    eventDao.findById.mockResolvedValue(stored);
    eventDao.update.mockResolvedValue({ ...stored });

    await updateEvent(supabase, 3, { speaker_profile_ids: [4] }, actor);

    expect(speakerDao.replaceEventAssignments).toHaveBeenCalledWith(supabase, 3, [4]);
    expect(eventDao.update).toHaveBeenCalledWith(supabase, 3, {});
  });
});

describe("updateEvent and the online/address pair", () => {
  it("clears the stored address when an event is switched online", async () => {
    // The form disables that input rather than emptying it, so the old street
    // address is still on the row. chk_event_online_has_no_address would reject
    // the write, turning a 400 into a 500 for the caller.
    await updateEvent(supabase, 1, { event_type: "online" }, actor);

    expect(eventDao.update).toHaveBeenCalledWith(supabase, 1, expect.objectContaining({ venue_address: null }));
  });

  it("refuses an address added to an event that is already online", async () => {
    eventDao.findById.mockResolvedValue({ id: 1, status: "active", event_type: "online" });

    await expect(updateEvent(supabase, 1, { venue_address: "123 Rizal St" }, actor)).rejects.toMatchObject({
      status: 400,
      message: "An online event cannot have a venue address",
    });
    expect(eventDao.update).not.toHaveBeenCalled();
  });

  it("allows an address on an event that is onsite", async () => {
    eventDao.findById.mockResolvedValue({ id: 1, status: "active", event_type: "onsite" });

    await updateEvent(supabase, 1, { venue_address: "123 Rizal St" }, actor);

    expect(eventDao.update).toHaveBeenCalledWith(supabase, 1, expect.objectContaining({ venue_address: "123 Rizal St" }));
  });

  it("allows an address in the same patch that turns the event onsite", async () => {
    await updateEvent(supabase, 1, { event_type: "onsite", venue_address: "123 Rizal St" }, actor);

    expect(eventDao.update).toHaveBeenCalledWith(supabase, 1, expect.objectContaining({ venue_address: "123 Rizal St" }));
  });

  it("clears the meeting link when an event is switched back to onsite", async () => {
    await updateEvent(supabase, 1, { event_type: "onsite" }, actor);

    // Otherwise a working meeting URL stays on a row nothing renders it from.
    expect(eventDao.update).toHaveBeenCalledWith(supabase, 1, expect.objectContaining({ meeting_url: null }));
  });

  it("refuses a link added to an event that is not online", async () => {
    eventDao.findById.mockResolvedValue({ id: 1, status: "active", event_type: "onsite" });

    await expect(updateEvent(supabase, 1, { meeting_url: "https://meet.google.com/abc" }, actor)).rejects.toMatchObject({
      status: 400,
      message: "Only an online event can have a meeting link",
    });
  });

  it("allows a link on an event that is already online", async () => {
    eventDao.findById.mockResolvedValue({ id: 1, status: "active", event_type: "online" });

    await updateEvent(supabase, 1, { meeting_url: "https://meet.google.com/abc" }, actor);

    expect(eventDao.update).toHaveBeenCalledWith(
      supabase,
      1,
      expect.objectContaining({ meeting_url: "https://meet.google.com/abc" }),
    );
  });

  it("reads no stored row for a patch that touches neither times nor address", async () => {
    await updateEvent(supabase, 1, { title: "Renamed" }, actor);

    expect(eventDao.findById).not.toHaveBeenCalled();
  });
});

describe("listEvents and the meeting link", () => {
  it("strips the link from every row, whoever is listing", async () => {
    // The list selects * and feeds the public listing and the landing page, so
    // a link left on a row reaches anyone who can see the event at all.
    eventDao.list.mockResolvedValue({
      data: [{ id: 1, status: "active", event_type: "online", meeting_url: "https://meet.google.com/abc" }],
      total: 1,
      page: 1,
      limit: 50,
    });

    const result = await listEvents(supabase, { role: ROLES.ADMIN, userId: 9, filter: null });

    expect(result.data[0].meeting_url).toBeNull();
  });
});

describe("setMeetingLink", () => {
  beforeEach(() => {
    eventDao.findById.mockResolvedValue({ id: 1, status: "active", event_type: "online" });
    eventDao.update.mockResolvedValue({ id: 1, meeting_url: "https://meet.google.com/abc" });
  });

  it("writes only the link, never the rest of the row", async () => {
    await setMeetingLink(supabase, 1, "https://meet.google.com/abc", actor);

    expect(eventDao.update).toHaveBeenCalledWith(supabase, 1, { meeting_url: "https://meet.google.com/abc" });
  });

  it("clears the link when handed null", async () => {
    await setMeetingLink(supabase, 1, null, actor);

    expect(eventDao.update).toHaveBeenCalledWith(supabase, 1, { meeting_url: null });
  });

  it("refuses an onsite event rather than letting the constraint answer", async () => {
    eventDao.findById.mockResolvedValue({ id: 1, status: "active", event_type: "onsite" });

    await expect(setMeetingLink(supabase, 1, "https://meet.google.com/abc", actor)).rejects.toMatchObject({
      status: 400,
      message: "Only an online event can have a meeting link",
    });
    expect(eventDao.update).not.toHaveBeenCalled();
  });

  it("404s for an event that does not exist", async () => {
    eventDao.findById.mockResolvedValue(null);

    await expect(setMeetingLink(supabase, 1, null, actor)).rejects.toMatchObject({ status: 404 });
  });

  it("audits the change without writing the URL into the audit row", async () => {
    // An audit row is readable by every admin, which is exactly the sort of
    // place a working door gets left lying around.
    await setMeetingLink(supabase, 1, "https://meet.google.com/abc", actor);

    expect(logAuditEvent).toHaveBeenCalledWith(supabase, 9, "event.updated", "event", 1, {
      changes: ["meeting_url"],
      cleared: false,
    });
    expect(JSON.stringify(logAuditEvent.mock.calls)).not.toContain("meet.google.com");
  });
});

describe("deleteEvent", () => {
  it("deletes each bucket's paths from its own bucket and reports success", async () => {
    eventDao.findById.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      cover_image_url: "/api/storage/event_images/events/1/cover.png",
    });
    courseDao.findCourseIdByEventId.mockResolvedValue(7);
    courseDao.findModulesByCourse.mockResolvedValue([{ id: 3 }]);
    courseDao.findLessonsByModule.mockResolvedValue([{ id: 5 }]);

    await deleteEvent(supabase, 1, actor);

    const byBucket = Object.fromEntries(deleteFromStorage.mock.calls.map(([bucket, paths]) => [bucket, paths]));
    expect(byBucket.event_images).toEqual(["events/1/event_images-file"]);
    expect(byBucket.course_assets).toEqual(["courses/7/modules/3/lessons/5/course_assets-file"]);
    expect(byBucket.course_videos).toEqual(["courses/7/modules/3/lessons/5/course_videos-file"]);
    expect(eventDao.remove).toHaveBeenCalledWith(supabase, 1);
    expect(logAuditEvent).toHaveBeenCalledWith(supabase, 9, "event.deleted", "event", 1, { title: "Launch Day" });
  });
});

describe("publishEvent", () => {
  it("refuses to publish anything but a draft", async () => {
    eventDao.findById.mockResolvedValue({ id: 1, status: "active" });

    await expect(publishEvent(supabase, 1, actor)).rejects.toMatchObject({
      status: 400,
      message: "Only draft events can be published",
    });
    expect(eventDao.updateField).not.toHaveBeenCalled();
  });

  it("moves a draft to active and audits the publisher", async () => {
    await publishEvent(supabase, 1, actor);

    expect(eventDao.updateField).toHaveBeenCalledWith(supabase, 1, "status", "active");
    expect(logAuditEvent).toHaveBeenCalledWith(supabase, 9, "event.published", "event", 1);
  });
});

describe("registerForEvent", () => {
  beforeEach(() => {
    eventDao.findById.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      status: "active",
      event_date: "2099-01-01",
      end_time: "10:00",
    });
    ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue(null);
    paymentDao.findPendingByUserAndEvent.mockResolvedValue(null);
  });

  it("throws 409 when the caller already holds an active ticket", async () => {
    ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue({ payment_id: 3 });

    await expect(registerForEvent(supabase, 1, { id: 5, role: ROLES.ATTENDEE })).rejects.toMatchObject({
      status: 409,
      message: "You already have an active ticket for this event",
    });
    expect(paymentDao.findPendingByUserAndEvent).not.toHaveBeenCalled();
  });

  it("resumes an existing pending payment", async () => {
    paymentDao.findPendingByUserAndEvent.mockResolvedValue({ id: 77 });

    await expect(registerForEvent(supabase, 1, { id: 5, role: ROLES.ATTENDEE })).resolves.toEqual({
      eligible: true,
      pending_payment_id: 77,
    });
  });

  it("refuses a seat on a sold-out event before any payment is opened", async () => {
    eventDao.findById.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      status: "active",
      event_date: "2099-01-01",
      end_time: "10:00",
      capacity: 3,
    });

    await expect(registerForEvent(supabase, 1, { id: 5, role: ROLES.ATTENDEE })).rejects.toMatchObject({
      status: 409,
      message: SOLD_OUT_MESSAGE,
    });
    expect(paymentDao.findPendingByUserAndEvent).not.toHaveBeenCalled();
  });

  it("admits the last seat rather than refusing it", async () => {
    eventDao.findById.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      status: "active",
      event_date: "2099-01-01",
      end_time: "10:00",
      capacity: 4,
    });

    await expect(registerForEvent(supabase, 1, { id: 5, role: ROLES.ATTENDEE })).resolves.toEqual({ eligible: true });
  });

  it("counts no tickets for an uncapped event", async () => {
    await expect(registerForEvent(supabase, 1, { id: 5, role: ROLES.ATTENDEE })).resolves.toEqual({ eligible: true });

    expect(eventDao.getAttendeeCount).not.toHaveBeenCalled();
  });

  it("refuses registration once the event has ended", async () => {
    const ended = new Date();
    ended.setDate(ended.getDate() - 1);
    eventDao.findById.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      status: "active",
      event_date: ended.toISOString().slice(0, 10),
      end_time: "10:00",
    });

    await expect(registerForEvent(supabase, 1, { id: 5, role: ROLES.ATTENDEE })).rejects.toMatchObject({
      status: 400,
      message: "Registration is closed — this event has ended",
    });
    expect(ticketDao.findActiveTicketByUserAndEvent).not.toHaveBeenCalled();
  });
});

describe("getEventRegistrationState", () => {
  beforeEach(() => {
    eventDao.findById.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      status: "active",
      event_date: "2099-01-01",
      end_time: "10:00",
    });
  });

  it("reports already_registered from the caller's own tickets", async () => {
    ticketDao.findActiveTicketByUserAndEvent.mockResolvedValue({ payment_id: 3 });

    const state = await getEventRegistrationState(supabase, 1, {
      id: 5,
      role: ROLES.ATTENDEE,
      full_name: "Jane",
      email: "jane@example.com",
    });

    expect(ticketDao.findActiveTicketByUserAndEvent).toHaveBeenCalledWith(supabase, 5, 1);
    expect(state).toMatchObject({ already_registered: true, user: { user_id: 5 } });
  });

  it("refuses to show registration state once the event has ended", async () => {
    const ended = new Date();
    ended.setDate(ended.getDate() - 1);
    eventDao.findById.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      status: "active",
      event_date: ended.toISOString().slice(0, 10),
      end_time: "10:00",
    });

    await expect(
      getEventRegistrationState(supabase, 1, { id: 5, role: ROLES.ATTENDEE, full_name: "Jane", email: "jane@example.com" }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Registration is closed — this event has ended",
    });
  });
});

describe("listEventAttendees", () => {
  it("normalizes the embedded user into a flat attendee row", async () => {
    ticketDao.getAttendees.mockResolvedValue({
      data: [
        { USER: { id: 5, full_name: "Jane", email: "j@example.com" }, status: "checked_in", issued_at: "a", updated_at: "b" },
      ],
      total: 1,
    });

    const result = await listEventAttendees(supabase, 1, { search: "", status: "all", page: 1, limit: 15 });

    expect(result.attendees).toEqual([
      {
        user_id: 5,
        full_name: "Jane",
        email: "j@example.com",
        ticket_status: "checked_in",
        issued_at: "a",
        checked_in_at: "b",
      },
    ]);
  });
});

describe("listAdminEventAttendees", () => {
  const pastEvent: Event = {
    id: 1,
    title: "Launch Day",
    event_date: "2020-01-01",
    start_time: "09:00",
    end_time: "10:00",
    venue_name: "Main Hall",
    venue_address: null,
    description: null,
    price: 0,
    currency: "PHP",
    cover_image_url: null,
    status: "complete",
    capacity: null,
    event_type: "onsite",
    meeting_url: null,
    survey_enabled: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };

  beforeEach(() => {
    getAttendeeSurveyFlags.mockResolvedValue({ usable: true, hasSurvey: true, byUser: new Map() });
  });

  it("maps action flags from the ticket and survey state", async () => {
    ticketDao.getAttendees.mockResolvedValue({
      data: [
        { USER: { id: 5, full_name: "Jane", email: "j@example.com" }, status: "issued", issued_at: "a", updated_at: "a" },
        { USER: { id: 6, full_name: "Bob", email: "b@example.com" }, status: "checked_in", issued_at: "b", updated_at: "b" },
        { USER: { id: 7, full_name: "Sam", email: "s@example.com" }, status: "cancelled", issued_at: "c", updated_at: "c" },
      ],
      total: 3,
    });
    getAttendeeSurveyFlags.mockResolvedValue({
      usable: true,
      hasSurvey: true,
      byUser: new Map([
        [5, { sent: true, responded: false }],
        [6, { sent: true, responded: true }],
      ]),
    });

    const result = await listAdminEventAttendees(supabase, pastEvent, {
      search: "",
      status: "all",
      page: 1,
      limit: 15,
    });

    const [issued, checkedIn, cancelled] = result.attendees;
    expect(issued).toMatchObject({
      user_id: 5,
      survey: { sent: true, responded: false },
      can_check_in: true,
      can_cancel: true,
      can_resend_ticket: true,
      can_send_survey: true,
      can_show_survey_send: true,
    });
    expect(checkedIn).toMatchObject({
      user_id: 6,
      survey: { sent: true, responded: true },
      can_check_in: false,
      can_cancel: false,
      can_resend_ticket: true,
      can_send_survey: false,
      can_show_survey_send: false,
    });
    expect(cancelled).toMatchObject({
      user_id: 7,
      survey: null,
      can_check_in: false,
      can_cancel: false,
      can_resend_ticket: false,
      can_send_survey: false,
      can_show_survey_send: false,
    });
    expect(result.survey).toEqual({
      opt_in: true,
      finished: true,
      sendable: true,
      status: "open",
    });
    expect(getAttendeeSurveyFlags).toHaveBeenCalledWith(supabase, pastEvent, [5, 6, 7]);
  });

  it("turns off every survey send when the survey is closed", async () => {
    ticketDao.getAttendees.mockResolvedValue({
      data: [{ USER: { id: 5, full_name: "Jane", email: "j@example.com" }, status: "issued", issued_at: "a", updated_at: "a" }],
      total: 1,
    });
    getAttendeeSurveyFlags.mockResolvedValue({ usable: false, hasSurvey: true, byUser: new Map() });

    const result = await listAdminEventAttendees(supabase, pastEvent, {
      search: "",
      status: "all",
      page: 1,
      limit: 15,
    });

    expect(result.attendees[0].can_send_survey).toBe(false);
    expect(result.attendees[0].can_show_survey_send).toBe(true);
    expect(result.survey).toEqual({ opt_in: true, finished: true, sendable: false, status: "closed" });
  });

  it("allows a standalone send before any survey exists", async () => {
    ticketDao.getAttendees.mockResolvedValue({
      data: [{ USER: { id: 5, full_name: "Jane", email: "j@example.com" }, status: "issued", issued_at: "a", updated_at: "a" }],
      total: 1,
    });
    getAttendeeSurveyFlags.mockResolvedValue({ usable: false, hasSurvey: false, byUser: new Map() });

    const result = await listAdminEventAttendees(supabase, pastEvent, {
      search: "",
      status: "all",
      page: 1,
      limit: 15,
    });

    expect(result.attendees[0].can_send_survey).toBe(true);
    expect(result.attendees[0].can_show_survey_send).toBe(true);
    expect(result.survey).toEqual({ opt_in: true, finished: true, sendable: true, status: "open" });
  });

  it("locks survey sends until the event ends", async () => {
    ticketDao.getAttendees.mockResolvedValue({
      data: [{ USER: { id: 5, full_name: "Jane", email: "j@example.com" }, status: "issued", issued_at: "a", updated_at: "a" }],
      total: 1,
    });
    getAttendeeSurveyFlags.mockResolvedValue({ usable: true, hasSurvey: true, byUser: new Map() });

    const result = await listAdminEventAttendees(
      supabase,
      { ...pastEvent, event_date: "2050-01-01" },
      { search: "", status: "all", page: 1, limit: 15 },
    );

    expect(result.attendees[0].can_show_survey_send).toBe(true);
    expect(result.attendees[0].can_send_survey).toBe(false);
    expect(result.survey).toEqual({ opt_in: true, finished: false, sendable: false, status: "locked" });
  });

  it("reports the survey status as disabled when surveys are off", async () => {
    ticketDao.getAttendees.mockResolvedValue({
      data: [{ USER: { id: 5, full_name: "Jane", email: "j@example.com" }, status: "issued", issued_at: "a", updated_at: "a" }],
      total: 1,
    });
    getAttendeeSurveyFlags.mockResolvedValue({ usable: true, hasSurvey: true, byUser: new Map() });

    const result = await listAdminEventAttendees(
      supabase,
      { ...pastEvent, survey_enabled: false },
      { search: "", status: "all", page: 1, limit: 15 },
    );

    expect(result.attendees[0].can_show_survey_send).toBe(false);
    expect(result.attendees[0].can_send_survey).toBe(false);
    expect(result.survey).toEqual({ opt_in: false, finished: true, sendable: false, status: "disabled" });
  });
});
