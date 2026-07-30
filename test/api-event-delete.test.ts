import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireRole,
  eventFindById,
  eventRemove,
  findModulesByCourse,
  findLessonsByModule,
  listStorageFolder,
  deleteFromStorage,
  logAuditEvent,
  maybeSingle,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  eventFindById: vi.fn(),
  eventRemove: vi.fn(),
  findModulesByCourse: vi.fn(),
  findLessonsByModule: vi.fn(),
  listStorageFolder: vi.fn(),
  deleteFromStorage: vi.fn(),
  logAuditEvent: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/modules/auth/lib/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/shared/db/client", () => ({
  getServiceClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }) }),
}));
vi.mock("@/shared/db/dao", () => ({
  eventDao: { findById: eventFindById, remove: eventRemove },
  courseDao: { findModulesByCourse, findLessonsByModule },
}));
vi.mock("@/shared/integrations/storage", () => ({ listStorageFolder, deleteFromStorage }));
vi.mock("@/modules/audit", () => ({ logAuditEvent }));

import { DELETE } from "@/app/api/events/[id]/route";

const facilitator = {
  allowed: true,
  error: null,
  user: { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com", profile_image_url: null },
};

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
  requireRole.mockResolvedValue(facilitator);
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
  it("refuses a caller without the facilitator role and deletes nothing", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await del();

    expect(res.status).toBe(401);
    expect(eventRemove).not.toHaveBeenCalled();
    expect(deleteFromStorage).not.toHaveBeenCalled();
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
