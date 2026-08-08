import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  eventDao,
  liveSessionDao,
  facilitatorDao,
  speakerDao,
  courseDao,
  ticketDao,
  paymentDao,
  listStorageFolder,
  deleteFromStorage,
  logAuditEvent,
} = vi.hoisted(() => ({
  eventDao: {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdWithCourse: vi.fn(),
    getAttendeeCount: vi.fn(),
    update: vi.fn(),
    updateField: vi.fn(),
    remove: vi.fn(),
  },
  liveSessionDao: { getHighlightState: vi.fn(), upsertHighlightState: vi.fn() },
  facilitatorDao: { replaceEventAssignments: vi.fn(), isAssigned: vi.fn() },
  speakerDao: { replaceEventAssignments: vi.fn(), isAssignedByUserId: vi.fn() },
  courseDao: {
    findModulesByCourse: vi.fn(),
    findLessonsByModule: vi.fn(),
    findLessonById: vi.fn(),
    findModuleById: vi.fn(),
    findIdByEventId: vi.fn(),
  },
  ticketDao: { findActiveByUserAndEvent: vi.fn(), getAttendees: vi.fn() },
  paymentDao: { findPendingByUserAndEvent: vi.fn() },
  listStorageFolder: vi.fn(),
  deleteFromStorage: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/events/db/event.dao", () => eventDao);
vi.mock("@/modules/events/db/live-session.dao", () => liveSessionDao);
vi.mock("@/shared/db/dao/facilitator.dao", () => facilitatorDao);
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/shared/db/dao/course.dao", () => courseDao);
vi.mock("@/shared/db/dao/ticket.dao", () => ticketDao);
vi.mock("@/shared/db/dao/payment.dao", () => paymentDao);
vi.mock("@/shared/integrations/storage/service", () => ({ listStorageFolder, deleteFromStorage }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

import { getServiceClient } from "@/shared/db/client";
import {
  canManageEvent,
  clearEventHighlight,
  createEvent,
  deleteEvent,
  EventServiceError,
  getEvent,
  getEventHighlight,
  getEventRegistrationState,
  listEventAttendees,
  loadEventOr403,
  publishEvent,
  registerForEvent,
  setEventHighlight,
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
  eventDao.update.mockResolvedValue({ id: 1, title: "Launch Day", status: "active" });
  eventDao.updateField.mockResolvedValue(true);
  eventDao.remove.mockResolvedValue(true);
  facilitatorDao.replaceEventAssignments.mockResolvedValue(true);
  facilitatorDao.isAssigned.mockResolvedValue(true);
  speakerDao.replaceEventAssignments.mockResolvedValue(true);
  speakerDao.isAssignedByUserId.mockResolvedValue(true);
  courseDao.findLessonById.mockResolvedValue({ id: 4, module_id: 11 });
  courseDao.findModuleById.mockResolvedValue({ id: 11, course_id: 7 });
  courseDao.findIdByEventId.mockResolvedValue(7);
  liveSessionDao.getHighlightState.mockResolvedValue(null);
  liveSessionDao.upsertHighlightState.mockResolvedValue({ highlighted_lesson_id: null });
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
    expect(await canManageEvent(supabase, { id: 1, role: "admin" }, 5)).toBe(true);
    expect(await canManageEvent(supabase, { id: 1, role: "super_admin" }, 5)).toBe(true);
    expect(facilitatorDao.isAssigned).not.toHaveBeenCalled();
    expect(speakerDao.isAssignedByUserId).not.toHaveBeenCalled();
  });

  it("admits a facilitator assigned to the event", async () => {
    facilitatorDao.isAssigned.mockResolvedValue(true);

    expect(await canManageEvent(supabase, { id: 7, role: "facilitator" }, 5)).toBe(true);
    expect(facilitatorDao.isAssigned).toHaveBeenCalledWith(supabase, 5, 7);
  });

  it("admits a speaker assigned to the event", async () => {
    speakerDao.isAssignedByUserId.mockResolvedValue(true);

    expect(await canManageEvent(supabase, { id: 8, role: "speaker" }, 5)).toBe(true);
    expect(speakerDao.isAssignedByUserId).toHaveBeenCalledWith(supabase, 8, 5);
  });

  it("denies an unassigned facilitator, an unassigned speaker, and an attendee", async () => {
    facilitatorDao.isAssigned.mockResolvedValue(false);
    speakerDao.isAssignedByUserId.mockResolvedValue(false);

    expect(await canManageEvent(supabase, { id: 7, role: "facilitator" }, 5)).toBe(false);
    expect(await canManageEvent(supabase, { id: 8, role: "speaker" }, 5)).toBe(false);
    expect(await canManageEvent(supabase, { id: 5, role: "attendee" }, 5)).toBe(false);
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

    await expect(loadEventOr403(supabase, 99, { id: 1, role: "admin" }, "edit")).rejects.toMatchObject({
      status: 404,
      message: "Event not found",
    });
  });

  it("admits an admin for every capability without checking assignments", async () => {
    for (const capability of ["edit", "delete", "publish", "attendees"] as const) {
      await expect(loadEventOr403(supabase, 1, { id: 1, role: "admin" }, capability)).resolves.toMatchObject({ id: 1 });
    }
    expect(facilitatorDao.isAssigned).not.toHaveBeenCalled();
  });

  it("admits a super_admin for delete", async () => {
    await expect(loadEventOr403(supabase, 1, { id: 1, role: "super_admin" }, "delete")).resolves.toMatchObject({ id: 1 });
  });

  it("admits an assigned facilitator for the write capabilities", async () => {
    for (const capability of ["edit", "publish", "attendees"] as const) {
      await expect(loadEventOr403(supabase, 1, { id: 7, role: "facilitator" }, capability)).resolves.toMatchObject({ id: 1 });
    }
    expect(facilitatorDao.isAssigned).toHaveBeenCalledWith(supabase, 1, 7);
  });

  it("throws 403 for an unassigned facilitator", async () => {
    facilitatorDao.isAssigned.mockResolvedValue(false);

    await expect(loadEventOr403(supabase, 1, { id: 7, role: "facilitator" }, "edit")).rejects.toMatchObject({
      status: 403,
      message: "Forbidden",
    });
  });

  it("refuses a facilitator even when assigned for delete", async () => {
    await expect(loadEventOr403(supabase, 1, { id: 7, role: "facilitator" }, "delete")).rejects.toMatchObject({
      status: 403,
      message: "Forbidden",
    });
  });

  it("throws 403 for an attendee", async () => {
    await expect(loadEventOr403(supabase, 1, { id: 5, role: "attendee" }, "attendees")).rejects.toMatchObject({
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

    const result = await getEvent(supabase, 1, { id: 9, role: "facilitator" });

    expect(facilitatorDao.isAssigned).toHaveBeenCalledWith(supabase, 1, 9);
    expect(result).toMatchObject({ attendee_count: 3, facilitator_ids: [9], speaker_profile_ids: [4] });
  });

  it("hides an event a facilitator is not assigned to", async () => {
    facilitatorDao.isAssigned.mockResolvedValue(false);

    await expect(getEvent(supabase, 1, { id: 9, role: "facilitator" })).rejects.toMatchObject({
      status: 404,
      message: "Event not found",
    });
  });

  it("does not consult the assignment roster for an admin", async () => {
    await getEvent(supabase, 1, { id: 9, role: "admin" });

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

describe("deleteEvent", () => {
  it("deletes each bucket's paths from its own bucket and reports success", async () => {
    eventDao.findById.mockResolvedValue({
      id: 1,
      title: "Launch Day",
      cover_image_url: "/api/storage/event_images/events/1/cover.png",
    });
    courseDao.findIdByEventId.mockResolvedValue(7);
    courseDao.findModulesByCourse.mockResolvedValue([{ id: 3 }]);
    courseDao.findLessonsByModule.mockResolvedValue([{ id: 5 }]);

    const result = await deleteEvent(supabase, 1, actor);

    const byBucket = Object.fromEntries(deleteFromStorage.mock.calls.map(([bucket, paths]) => [bucket, paths]));
    expect(byBucket.event_images).toEqual(["events/1/event_images-file"]);
    expect(byBucket.course_assets).toEqual(["courses/7/modules/3/lessons/5/course_assets-file"]);
    expect(byBucket.course_videos).toEqual(["courses/7/modules/3/lessons/5/course_videos-file"]);
    expect(eventDao.remove).toHaveBeenCalledWith(supabase, 1);
    expect(logAuditEvent).toHaveBeenCalledWith(supabase, 9, "event.deleted", "event", 1, { title: "Launch Day" });
    expect(result).toEqual({ success: true });
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
    const result = await publishEvent(supabase, 1, actor);

    expect(eventDao.updateField).toHaveBeenCalledWith(supabase, 1, "status", "active");
    expect(logAuditEvent).toHaveBeenCalledWith(supabase, 9, "event.published", "event", 1);
    expect(result).toEqual({ success: true });
  });
});

describe("registerForEvent", () => {
  beforeEach(() => {
    eventDao.findById.mockResolvedValue({ id: 1, title: "Launch Day", status: "active" });
    ticketDao.findActiveByUserAndEvent.mockResolvedValue([]);
    paymentDao.findPendingByUserAndEvent.mockResolvedValue(null);
  });

  it("throws 409 when the caller already holds an active ticket", async () => {
    ticketDao.findActiveByUserAndEvent.mockResolvedValue([{ payment_id: 3 }]);

    await expect(registerForEvent(supabase, 1, { id: 5, role: "attendee" })).rejects.toMatchObject({
      status: 409,
      message: "You already have an active ticket for this event",
    });
    expect(paymentDao.findPendingByUserAndEvent).not.toHaveBeenCalled();
  });

  it("resumes an existing pending payment", async () => {
    paymentDao.findPendingByUserAndEvent.mockResolvedValue({ id: 77 });

    await expect(registerForEvent(supabase, 1, { id: 5, role: "attendee" })).resolves.toEqual({
      eligible: true,
      pending_payment_id: 77,
    });
  });
});

describe("getEventRegistrationState", () => {
  beforeEach(() => {
    eventDao.findById.mockResolvedValue({ id: 1, title: "Launch Day", status: "active" });
  });

  it("reports already_registered from the caller's own tickets", async () => {
    ticketDao.findActiveByUserAndEvent.mockResolvedValue([{ payment_id: 3 }]);

    const state = await getEventRegistrationState(supabase, 1, {
      id: 5,
      role: "attendee",
      full_name: "Jane",
      email: "jane@example.com",
    });

    expect(ticketDao.findActiveByUserAndEvent).toHaveBeenCalledWith(supabase, 5, 1);
    expect(state).toMatchObject({ already_registered: true, user: { user_id: 5 } });
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

describe("live highlight", () => {
  it("reports nothing highlighted when no state row exists", async () => {
    liveSessionDao.getHighlightState.mockResolvedValue(null);

    await expect(getEventHighlight(supabase, 9)).resolves.toEqual({
      highlighted_lesson_id: null,
      updated_by: null,
      updated_at: null,
      lesson: null,
    });
  });

  it("refuses a lesson from another event's course", async () => {
    eventDao.findById.mockResolvedValue({ id: 9 });
    courseDao.findIdByEventId.mockResolvedValue(99);

    await expect(setEventHighlight(supabase, 9, 4, { id: 3 })).rejects.toMatchObject({
      status: 400,
      message: "Lesson does not belong to this event's course",
    });
  });

  it("clears the highlight with the caller as updated_by", async () => {
    liveSessionDao.upsertHighlightState.mockResolvedValue({ highlighted_lesson_id: null });

    await expect(clearEventHighlight(supabase, 9, { id: 3 })).resolves.toEqual({ highlighted_lesson_id: null });
    expect(liveSessionDao.upsertHighlightState).toHaveBeenCalledWith(
      supabase,
      9,
      expect.objectContaining({ highlighted_lesson_id: null, updated_by: 3 }),
    );
  });
});
