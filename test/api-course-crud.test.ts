import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, dao, isAssigned, isAssignedByUserId, storage, logAuditEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  dao: {
    findCourseWithDetails: vi.fn(),
    findCourseEvent: vi.fn(),
    findCourseById: vi.fn(),
    findModulesByCourse: vi.fn(),
    findLessonsByModule: vi.fn(),
    updateCourse: vi.fn(),
    deleteCourse: vi.fn(),
  },
  isAssigned: vi.fn(),
  isAssignedByUserId: vi.fn(),
  storage: { listStorageFolder: vi.fn(), deleteFromStorage: vi.fn() },
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => dao);
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ isAssigned }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ isAssignedByUserId }));
vi.mock("@/shared/integrations/storage/service", () => storage);
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));

import { GET, PATCH, DELETE } from "@/app/api/courses/[id]/route";

const OWNER = { allowed: true, error: null, user: { id: 5, role: ROLES.SPEAKER } };
const OTHER_SPEAKER = { allowed: true, error: null, user: { id: 9, role: ROLES.SPEAKER } };
const FACILITATOR = { allowed: true, error: null, user: { id: 9, role: ROLES.FACILITATOR } };
const ADMIN = { allowed: true, error: null, user: { id: 9, role: ROLES.ADMIN } };

const params = { params: Promise.resolve({ id: "7" }) };
const VALID_BODY = { course_name: "Fundamentals", course_description: "Week one", event_id: 3 };

function patch(body: unknown) {
  return new Request("https://app.test/api/courses/7", { method: "PATCH", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(OWNER);
  dao.findCourseWithDetails.mockResolvedValue({ id: 7, course_name: "Fundamentals" });
  dao.findCourseEvent.mockResolvedValue({ id: 7, event_id: 100 });
  dao.findCourseById.mockResolvedValue({ id: 7, course_name: "Fundamentals" });
  dao.findModulesByCourse.mockResolvedValue([]);
  dao.findLessonsByModule.mockResolvedValue([]);
  dao.updateCourse.mockResolvedValue({ id: 7, course_name: "Fundamentals" });
  dao.deleteCourse.mockResolvedValue(true);
  isAssigned.mockResolvedValue(false);
  isAssignedByUserId.mockResolvedValue(false);
  storage.listStorageFolder.mockResolvedValue([]);
  storage.deleteFromStorage.mockResolvedValue(undefined);
  logAuditEvent.mockResolvedValue(undefined);
});

describe("GET /api/courses/[id]", () => {
  it("refuses a caller the guard turned away", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await GET(new Request("https://app.test/api/courses/7"), params);

    expect(res.status).toBe(401);
    expect(dao.findCourseWithDetails).not.toHaveBeenCalled();
  });

  it("answers 404 for a course that does not exist", async () => {
    dao.findCourseWithDetails.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/courses/7"), params);

    expect(res.status).toBe(404);
  });

  it("returns the course to a speaker", async () => {
    const res = await GET(new Request("https://app.test/api/courses/7"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: 7 });
  });
});

describe("PATCH /api/courses/[id]", () => {
  it("lets the owner edit their own course", async () => {
    isAssignedByUserId.mockResolvedValue(true);
    const res = await PATCH(patch(VALID_BODY), params);

    expect(res.status).toBe(200);
    expect(dao.updateCourse).toHaveBeenCalledWith({}, 7, {
      course_name: "Fundamentals",
      course_description: "Week one",
    });
  });

  it("turns another speaker away from a course they do not own", async () => {
    requireRole.mockResolvedValue(OTHER_SPEAKER);

    const res = await PATCH(patch(VALID_BODY), params);

    expect(res.status).toBe(403);
    expect(dao.updateCourse).not.toHaveBeenCalled();
  });

  it("lets a facilitator edit a course somebody else made", async () => {
    requireRole.mockResolvedValue(FACILITATOR);
    isAssigned.mockResolvedValue(true);

    const res = await PATCH(patch(VALID_BODY), params);

    expect(res.status).toBe(200);
  });

  it("rejects a body the schema does not accept", async () => {
    isAssignedByUserId.mockResolvedValue(true);
    const res = await PATCH(patch({ course_name: "", event_id: 3 }), params);

    expect(res.status).toBe(400);
    expect(dao.updateCourse).not.toHaveBeenCalled();
  });

  it("stores an absent description as null rather than dropping the column", async () => {
    isAssignedByUserId.mockResolvedValue(true);
    await PATCH(patch({ course_name: "Fundamentals", event_id: 3 }), params);

    expect(dao.updateCourse).toHaveBeenCalledWith({}, 7, expect.objectContaining({ course_description: null }));
  });

  it("reports a failed write instead of a success", async () => {
    isAssignedByUserId.mockResolvedValue(true);
    dao.updateCourse.mockResolvedValue(null);

    const res = await PATCH(patch(VALID_BODY), params);

    expect(res.status).toBe(500);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("records who changed what", async () => {
    isAssignedByUserId.mockResolvedValue(true);
    await PATCH(patch(VALID_BODY), params);

    expect(logAuditEvent).toHaveBeenCalledWith({}, 5, "course.updated", "course", 7, {
      changes: ["course_name", "course_description", "event_id"],
    });
  });
});

describe("DELETE /api/courses/[id]", () => {
  it("lets an assigned facilitator delete the course they manage", async () => {
    requireRole.mockResolvedValue(FACILITATOR);
    isAssigned.mockResolvedValue(true);

    const res = await DELETE(new Request("https://app.test/api/courses/7"), params);

    expect(res.status).toBe(200);
    expect(dao.deleteCourse).toHaveBeenCalledWith({}, 7);
  });

  it("refuses a facilitator who is not assigned to the event", async () => {
    // Deliberately stricter than PATCH: an assigned speaker may write material
    // but cannot take the course down, and deletion is reserved for the event's
    // facilitators and admins.
    requireRole.mockResolvedValue(FACILITATOR);

    const res = await DELETE(new Request("https://app.test/api/courses/7"), params);

    expect(res.status).toBe(403);
    expect(dao.deleteCourse).not.toHaveBeenCalled();
  });

  it("lets an admin delete a course somebody else made", async () => {
    requireRole.mockResolvedValue(ADMIN);

    const res = await DELETE(new Request("https://app.test/api/courses/7"), params);

    expect(res.status).toBe(200);
  });

  it("clears the uploads of every lesson before dropping the course", async () => {
    // Deleting the rows alone leaves the files orphaned in storage, which is a
    // bug this project has already shipped once.
    requireRole.mockResolvedValue(ADMIN);
    dao.findModulesByCourse.mockResolvedValue([{ id: 11 }]);
    dao.findLessonsByModule.mockResolvedValue([{ id: 22 }]);
    storage.listStorageFolder.mockResolvedValue(["courses/7/modules/11/lessons/22/file.pdf"]);

    await DELETE(new Request("https://app.test/api/courses/7"), params);

    expect(storage.listStorageFolder).toHaveBeenCalledWith("course_assets", "courses/7/modules/11/lessons/22");
    expect(storage.listStorageFolder).toHaveBeenCalledWith("course_videos", "courses/7/modules/11/lessons/22");
    expect(storage.deleteFromStorage).toHaveBeenCalledWith("course_assets", ["courses/7/modules/11/lessons/22/file.pdf"]);
  });

  it("reports a failed delete instead of a success", async () => {
    requireRole.mockResolvedValue(ADMIN);
    dao.deleteCourse.mockResolvedValue(false);

    const res = await DELETE(new Request("https://app.test/api/courses/7"), params);

    expect(res.status).toBe(500);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
