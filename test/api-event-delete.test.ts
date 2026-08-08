import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAuth,
  eventFindById,
  eventRemove,
  findModulesByCourse,
  findLessonsByModule,
  listStorageFolder,
  deleteFromStorage,
  logAuditEvent,
  maybeSingle,
} = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  eventFindById: vi.fn(),
  eventRemove: vi.fn(),
  findModulesByCourse: vi.fn(),
  findLessonsByModule: vi.fn(),
  listStorageFolder: vi.fn(),
  deleteFromStorage: vi.fn(),
  logAuditEvent: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));
vi.mock("@/modules/events/db/event.dao", () => ({ findById: eventFindById, remove: eventRemove }));
vi.mock("@/shared/db/dao/course.dao", () => ({ findModulesByCourse, findLessonsByModule }));

vi.mock("@/shared/integrations/storage/service", () => ({ listStorageFolder, deleteFromStorage }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));

import { DELETE } from "@/app/api/events/[id]/route";

const user = (id: number, role: string) => ({
  id,
  role,
  full_name: "Fay",
  email: "fay@example.com",
  profile_image_url: null,
});
const admin = user(9, "admin");
const facilitator = user(10, "facilitator");
const attendee = user(5, "attendee");

const del = (id = "1") =>
  DELETE(new Request(`https://app.test/api/events/${id}`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });

/** What each bucket was asked to delete, regardless of call order. */
function deletions() {
  return Object.fromEntries(deleteFromStorage.mock.calls.map(([bucket, paths]) => [bucket, paths]));
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(admin);
  eventFindById.mockResolvedValue({
    id: 1,
    title: "Launch Day",
    cover_image_url: "/api/storage/event_images/events/1/cover.png",
  });
  eventRemove.mockResolvedValue(true);
  maybeSingle.mockResolvedValue({ data: { id: 7 } });
  findModulesByCourse.mockResolvedValue([{ id: 3 }]);
  findLessonsByModule.mockResolvedValue([{ id: 5 }]);
  listStorageFolder.mockImplementation(async (bucket: string, folder: string) => [`${folder}/${bucket}-file`]);
  deleteFromStorage.mockResolvedValue(undefined);
});

describe("DELETE /api/events/[id] authorization", () => {
  it("refuses a caller below admin and deletes nothing", async () => {
    requireAuth.mockResolvedValue(attendee);

    const res = await del();

    expect(res.status).toBe(403);
    expect(eventRemove).not.toHaveBeenCalled();
    expect(deleteFromStorage).not.toHaveBeenCalled();
  });

  it("refuses a facilitator even when assigned to the event", async () => {
    requireAuth.mockResolvedValue(facilitator);

    const res = await del();

    expect(res.status).toBe(403);
    expect(eventRemove).not.toHaveBeenCalled();
    expect(deleteFromStorage).not.toHaveBeenCalled();
  });

  it("returns 401 for an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await del();

    expect(res.status).toBe(401);
    expect(eventRemove).not.toHaveBeenCalled();
  });

  it("returns 404 for an event that does not exist", async () => {
    eventFindById.mockResolvedValue(null);

    const res = await del();

    expect(res.status).toBe(404);
    expect(eventRemove).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/events/[id] storage cleanup", () => {
  it("removes course assets and videos from their own buckets", async () => {
    await del();

    const byBucket = deletions();
    // Both were collected before the fix and then never deleted, because the
    // single delete call only ever targeted event_images.
    expect(byBucket.course_assets).toEqual(["courses/7/modules/3/lessons/5/course_assets-file"]);
    expect(byBucket.course_videos).toEqual(["courses/7/modules/3/lessons/5/course_videos-file"]);
  });

  it("removes the event's own images from event_images", async () => {
    await del();

    expect(deletions().event_images).toEqual(["events/1/event_images-file"]);
  });

  it("never asks a bucket to delete another bucket's paths", async () => {
    await del();

    for (const [bucket, paths] of deleteFromStorage.mock.calls) {
      const foreign = (paths as string[]).filter((p) => !p.endsWith(`${bucket}-file`));
      expect(foreign).toEqual([]);
    }
  });

  it("collects nothing from course buckets when the event has no course", async () => {
    maybeSingle.mockResolvedValue({ data: null });

    await del();

    expect(deletions().course_assets).toEqual([]);
    expect(deletions().course_videos).toEqual([]);
  });

  it("skips event images when the event has no cover", async () => {
    eventFindById.mockResolvedValue({ id: 1, title: "Launch Day", cover_image_url: null });

    await del();

    expect(deletions().event_images).toEqual([]);
  });

  it("deletes the row before touching storage, so a failed delete leaves files alone", async () => {
    eventRemove.mockResolvedValue(false);

    const res = await del();

    expect(res.status).toBe(500);
    expect(deleteFromStorage).not.toHaveBeenCalled();
  });

  it("still reports success when storage cleanup fails", async () => {
    deleteFromStorage.mockRejectedValue(new Error("bucket unreachable"));

    const res = await del();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
  });

  it("records the deletion in the audit log", async () => {
    await del();

    expect(logAuditEvent).toHaveBeenCalledWith(expect.anything(), 9, "event.deleted", "event", 1, { title: "Launch Day" });
  });
});
