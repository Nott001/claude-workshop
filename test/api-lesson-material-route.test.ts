import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const {
  requireRole,
  requireLessonAccess,
  findLessonModule,
  findModuleCourse,
  updateLesson,
  logAuditEvent,
  deleteFromStorage,
  listStorageFolder,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireLessonAccess: vi.fn(),
  findLessonModule: vi.fn(),
  findModuleCourse: vi.fn(),
  updateLesson: vi.fn(),
  logAuditEvent: vi.fn(),
  deleteFromStorage: vi.fn(),
  listStorageFolder: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/modules/auth/lib/guard-response", () => ({
  guardFailure: (guard: { error: string }) => NextResponse.json({ error: guard.error }, { status: 403 }),
}));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => ({ findLessonModule, findModuleCourse, updateLesson }));
vi.mock("@/shared/integrations/storage/service", () => ({ deleteFromStorage, listStorageFolder }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));
vi.mock("@/modules/courses/lib/course-access", () => ({ requireLessonAccess }));

import { DELETE } from "@/app/api/lessons/[id]/material/route";

const speaker = {
  allowed: true,
  error: null,
  user: { id: 8, role: ROLES.SPEAKER, full_name: "Sam", email: "sam@example.com", profile_image_url: null },
};

function call(id = "3") {
  return DELETE(new Request(`https://app.test/api/lessons/${id}/material`, { method: "DELETE" }), {
    params: Promise.resolve({ id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(speaker);
  requireLessonAccess.mockResolvedValue(null);
  findLessonModule.mockResolvedValue({ id: 3, module_id: 1 });
  findModuleCourse.mockResolvedValue({ id: 1, course_id: 7 });
  listStorageFolder.mockResolvedValue(["courses/7/modules/1/lessons/3/slides.pdf"]);
  updateLesson.mockResolvedValue({ id: 3, content_url: null });
});

describe("DELETE /api/lessons/[id]/material", () => {
  it("clears the lesson's url so a different file can take its place", async () => {
    const res = await call();

    expect(res.status).toBe(200);
    expect(updateLesson).toHaveBeenCalledWith(expect.anything(), 3, { content_url: null });
  });

  // Found by listing the lesson's own folder, not by parsing content_url: a
  // replaced upload leaves more than one object behind.
  it("sweeps both course buckets under the lesson's folder", async () => {
    await call();

    expect(listStorageFolder).toHaveBeenCalledWith("course_assets", "courses/7/modules/1/lessons/3");
    expect(listStorageFolder).toHaveBeenCalledWith("course_videos", "courses/7/modules/1/lessons/3");
    expect(deleteFromStorage).toHaveBeenCalledWith("course_assets", ["courses/7/modules/1/lessons/3/slides.pdf"]);
    expect(deleteFromStorage).toHaveBeenCalledWith("course_videos", ["courses/7/modules/1/lessons/3/slides.pdf"]);
  });

  it("records the detachment in the audit log", async () => {
    await call();

    expect(logAuditEvent).toHaveBeenCalledWith(expect.anything(), 8, "lesson.updated", "lesson", 3, {
      material: "removed",
    });
  });

  it("refuses a caller the guard rejects", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden" });

    const res = await call();

    expect(res.status).toBe(403);
    expect(updateLesson).not.toHaveBeenCalled();
  });

  it("refuses a caller without access to the lesson", async () => {
    requireLessonAccess.mockResolvedValue(NextResponse.json({ error: "No access" }, { status: 403 }));

    const res = await call();

    expect(res.status).toBe(403);
    expect(updateLesson).not.toHaveBeenCalled();
  });

  it("answers 404 for a lesson that does not exist", async () => {
    findLessonModule.mockResolvedValue(null);

    const res = await call();

    expect(res.status).toBe(404);
    expect(updateLesson).not.toHaveBeenCalled();
  });

  // The row still has to lose its url; an unresolvable course only means there
  // is no folder to sweep.
  it("still clears the url when the module's course cannot be found", async () => {
    findModuleCourse.mockResolvedValue(null);

    const res = await call();

    expect(res.status).toBe(200);
    expect(listStorageFolder).not.toHaveBeenCalled();
    expect(updateLesson).toHaveBeenCalledWith(expect.anything(), 3, { content_url: null });
  });

  it("reports a failed update rather than claiming success", async () => {
    updateLesson.mockResolvedValue(null);

    const res = await call();

    expect(res.status).toBe(500);
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
