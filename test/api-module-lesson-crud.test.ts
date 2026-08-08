import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { requireRole, dao, storage, logAuditEvent, requireModuleAccess, requireLessonAccess } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  dao: {
    setModuleLock: vi.fn(),
    updateModule: vi.fn(),
    deleteModule: vi.fn(),
    findModuleById: vi.fn(),
    findLessonsByModule: vi.fn(),
    findLessonById: vi.fn(),
    updateLesson: vi.fn(),
    deleteLesson: vi.fn(),
    findLessonModule: vi.fn(),
    findModuleCourse: vi.fn(),
  },
  storage: { listStorageFolder: vi.fn(), deleteFromStorage: vi.fn() },
  logAuditEvent: vi.fn(),
  requireModuleAccess: vi.fn(),
  requireLessonAccess: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => dao);
vi.mock("@/shared/integrations/storage/service", () => storage);
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));
vi.mock("@/modules/courses/lib/course-access", () => ({ requireModuleAccess, requireLessonAccess }));

import { PATCH as patchModule, DELETE as deleteModule } from "@/app/api/modules/[id]/route";
import { GET as getLesson, PATCH as patchLesson, DELETE as deleteLesson } from "@/app/api/lessons/[id]/route";

const SPEAKER = { allowed: true, error: null, user: { id: 5, role: ROLES.SPEAKER } };
const params = { params: Promise.resolve({ id: "11" }) };

const MODULE_BODY = { module_name: "Week one", sequence_order: 1 };
const LESSON_BODY = { description: "Intro", content_type: "pdf", sequence_order: 1 };

function body(url: string, payload: unknown) {
  return new Request(url, { method: "PATCH", body: JSON.stringify(payload) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(SPEAKER);
  requireModuleAccess.mockResolvedValue(null);
  requireLessonAccess.mockResolvedValue(null);
  dao.setModuleLock.mockResolvedValue({ id: 11, is_locked: true });
  dao.updateModule.mockResolvedValue({ id: 11, module_name: "Week one" });
  dao.deleteModule.mockResolvedValue(true);
  dao.findModuleById.mockResolvedValue({ id: 11, course_id: 7 });
  dao.findLessonsByModule.mockResolvedValue([]);
  dao.findLessonById.mockResolvedValue({ id: 11, description: "Intro" });
  dao.updateLesson.mockResolvedValue({ id: 11, description: "Intro" });
  dao.deleteLesson.mockResolvedValue(true);
  dao.findLessonModule.mockResolvedValue({ module_id: 11 });
  dao.findModuleCourse.mockResolvedValue({ course_id: 7 });
  storage.listStorageFolder.mockResolvedValue([]);
  storage.deleteFromStorage.mockResolvedValue(undefined);
  logAuditEvent.mockResolvedValue(undefined);
});

describe("PATCH /api/modules/[id]", () => {
  it("hands back the refusal the access check produced", async () => {
    requireModuleAccess.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));

    const res = await patchModule(body("https://app.test/api/modules/11", MODULE_BODY), params);

    expect(res.status).toBe(403);
    expect(dao.updateModule).not.toHaveBeenCalled();
  });

  it("locks a module without demanding the rest of its fields", async () => {
    // The lock toggle sends is_locked alone; running it through the module
    // schema would reject it for the name and order it does not carry.
    const res = await patchModule(body("https://app.test/api/modules/11", { is_locked: true }), params);

    expect(res.status).toBe(200);
    expect(dao.setModuleLock).toHaveBeenCalledWith({}, 11, true);
    expect(dao.updateModule).not.toHaveBeenCalled();
  });

  it("reports a lock that did not take", async () => {
    dao.setModuleLock.mockResolvedValue(null);

    const res = await patchModule(body("https://app.test/api/modules/11", { is_locked: false }), params);

    expect(res.status).toBe(500);
  });

  it("rejects a rename the schema does not accept", async () => {
    const res = await patchModule(body("https://app.test/api/modules/11", { module_name: "", sequence_order: 0 }), params);

    expect(res.status).toBe(400);
    expect(dao.updateModule).not.toHaveBeenCalled();
  });

  it("renames a module and records it", async () => {
    const res = await patchModule(body("https://app.test/api/modules/11", MODULE_BODY), params);

    expect(res.status).toBe(200);
    expect(dao.updateModule).toHaveBeenCalledWith({}, 11, { module_name: "Week one", sequence_order: 1 });
    expect(logAuditEvent).toHaveBeenCalledWith({}, 5, "module.updated", "module", 11, expect.anything());
  });
});

describe("DELETE /api/modules/[id]", () => {
  it("clears each lesson's uploads under the module's own course", async () => {
    dao.findLessonsByModule.mockResolvedValue([{ id: 22 }]);
    storage.listStorageFolder.mockResolvedValue(["courses/7/modules/11/lessons/22/slides.pdf"]);

    await deleteModule(new Request("https://app.test/api/modules/11"), params);

    expect(storage.listStorageFolder).toHaveBeenCalledWith("course_assets", "courses/7/modules/11/lessons/22");
    expect(storage.deleteFromStorage).toHaveBeenCalledWith("course_videos", expect.any(Array));
  });

  it("reports a failed delete instead of a success", async () => {
    dao.deleteModule.mockResolvedValue(false);

    const res = await deleteModule(new Request("https://app.test/api/modules/11"), params);

    expect(res.status).toBe(500);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("GET /api/lessons/[id]", () => {
  it("hands back the refusal the access check produced", async () => {
    requireLessonAccess.mockResolvedValue(NextResponse.json({ error: "Lesson not found" }, { status: 404 }));

    const res = await getLesson(new Request("https://app.test/api/lessons/11"), params);

    expect(res.status).toBe(404);
    expect(dao.findLessonById).not.toHaveBeenCalled();
  });

  it("answers 404 for a lesson that does not exist", async () => {
    dao.findLessonById.mockResolvedValue(null);

    const res = await getLesson(new Request("https://app.test/api/lessons/11"), params);

    expect(res.status).toBe(404);
  });

  it("returns the lesson", async () => {
    const res = await getLesson(new Request("https://app.test/api/lessons/11"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({ id: 11 });
  });
});

describe("PATCH /api/lessons/[id]", () => {
  it("leaves the stored file alone when the edit carries no url", async () => {
    // Writing content_url unconditionally would blank the upload every time
    // somebody edited a lesson's description.
    await patchLesson(body("https://app.test/api/lessons/11", LESSON_BODY), params);

    expect(dao.updateLesson).toHaveBeenCalledWith({}, 11, expect.not.objectContaining({ content_url: expect.anything() }));
  });

  it("writes the url when the edit supplies one", async () => {
    await patchLesson(body("https://app.test/api/lessons/11", { ...LESSON_BODY, content_url: "a/b.pdf" }), params);

    expect(dao.updateLesson).toHaveBeenCalledWith({}, 11, expect.objectContaining({ content_url: "a/b.pdf" }));
  });

  it("rejects a content type outside the allowed set", async () => {
    const res = await patchLesson(body("https://app.test/api/lessons/11", { ...LESSON_BODY, content_type: "exe" }), params);

    expect(res.status).toBe(400);
    expect(dao.updateLesson).not.toHaveBeenCalled();
  });

  it("reports a failed write instead of a success", async () => {
    dao.updateLesson.mockResolvedValue(null);

    const res = await patchLesson(body("https://app.test/api/lessons/11", LESSON_BODY), params);

    expect(res.status).toBe(500);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/lessons/[id]", () => {
  it("finds the lesson's folder through its module's course", async () => {
    storage.listStorageFolder.mockResolvedValue(["courses/7/modules/11/lessons/11/clip.mp4"]);

    await deleteLesson(new Request("https://app.test/api/lessons/11"), params);

    expect(dao.findModuleCourse).toHaveBeenCalledWith({}, 11);
    expect(storage.listStorageFolder).toHaveBeenCalledWith("course_videos", "courses/7/modules/11/lessons/11");
  });

  it("still deletes the row when the lesson has no module to trace", async () => {
    dao.findLessonModule.mockResolvedValue(null);

    const res = await deleteLesson(new Request("https://app.test/api/lessons/11"), params);

    expect(res.status).toBe(200);
    expect(storage.listStorageFolder).not.toHaveBeenCalled();
    expect(dao.deleteLesson).toHaveBeenCalledWith({}, 11);
  });

  it("reports a failed delete instead of a success", async () => {
    dao.deleteLesson.mockResolvedValue(false);

    const res = await deleteLesson(new Request("https://app.test/api/lessons/11"), params);

    expect(res.status).toBe(500);
  });
});
