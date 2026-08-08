import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const {
  requireRole,
  requireLessonAccess,
  findLessonModule,
  findModuleCourse,
  findCourseEvent,
  findCourseByLesson,
  updateLesson,
  uploadToStorage,
  validateFileSize,
} = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireLessonAccess: vi.fn(),
  findLessonModule: vi.fn(),
  findModuleCourse: vi.fn(),
  findCourseEvent: vi.fn(),
  findCourseByLesson: vi.fn(),
  updateLesson: vi.fn(),
  uploadToStorage: vi.fn(),
  validateFileSize: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/modules/courses/lib/course-access", () => ({ requireLessonAccess }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => ({
  findLessonModule,
  findModuleCourse,
  findCourseEvent,
  findCourseByLesson,
  updateLesson,
}));
vi.mock("@/shared/integrations/storage/service", () => ({ uploadToStorage }));
// validateFileType stays real; only the size gate is stubbed so an oversized
// file can be simulated without allocating 50 MB of fixture bytes.
vi.mock("@/shared/integrations/storage/policy", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/integrations/storage/policy")>();
  return { ...actual, validateFileSize };
});

import { POST as postAsset } from "@/app/api/upload/course-asset/route";
import { POST as postVideo } from "@/app/api/upload/course-video/route";
import { buildCourseAssetPath, buildCourseVideoPath } from "@/shared/integrations/storage/policy";

const speaker = {
  allowed: true,
  error: null,
  user: { id: 8, role: ROLES.SPEAKER, full_name: "Sam", email: "sam@example.com", profile_image_url: null },
};
const facilitator = {
  allowed: true,
  error: null,
  user: { id: 9, role: ROLES.FACILITATOR, full_name: "Fay", email: "fay@example.com", profile_image_url: null },
};
const denied = { allowed: false, error: "Forbidden", user: null };

function NextResponse403() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Lesson 3 hangs off module 2, which hangs off course 1 — the ids the path
// must come from, never from whatever the form claims. Course 1 is the course
// the route resolves from that chain for the access check.
const lesson = { module_id: 2 };
const mod = { course_id: 1 };
const course = { id: 1, event_id: 100 };

function upload(handler: typeof postAsset, fields: Record<string, string | File>): Promise<Response> {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return handler(new Request("https://app.test/api/upload/course-asset", { method: "POST", body: form }));
}

function assetUpload(fields: Record<string, string | File>): Promise<Response> {
  return upload(postAsset, fields);
}

function videoUpload(fields: Record<string, string | File>): Promise<Response> {
  return upload(postVideo, fields);
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(speaker);
  requireLessonAccess.mockResolvedValue(null);
  findLessonModule.mockResolvedValue(lesson);
  findModuleCourse.mockResolvedValue(mod);
  findCourseEvent.mockResolvedValue(course);
  updateLesson.mockResolvedValue({ id: 3 });
  uploadToStorage.mockResolvedValue({ url: "/api/storage/course_assets/x", path: "x" });
  validateFileSize.mockReturnValue(true);
});

describe("POST /api/upload/course-asset", () => {
  const pdf = (name = "slides.pdf") => new File(["x"], name, { type: "application/pdf" });

  it("uploads for an assigned speaker, deriving the path from the DAO chain", async () => {
    const res = await assetUpload({ file: pdf(), lesson_id: "3" });

    expect(res.status).toBe(200);
    const expected = buildCourseAssetPath(mod.course_id, lesson.module_id, 3, "slides.pdf");
    expect(uploadToStorage).toHaveBeenCalledWith("course_assets", expected, expect.any(File));
    expect(updateLesson).toHaveBeenCalledWith(expect.anything(), 3, { content_url: expect.any(String) });
  });

  it("ignores a forged course_id in the form when building the path", async () => {
    await assetUpload({ file: pdf(), lesson_id: "3", course_id: "999", module_id: "888" });

    const expected = buildCourseAssetPath(mod.course_id, lesson.module_id, 3, "slides.pdf");
    expect(uploadToStorage).toHaveBeenCalledWith("course_assets", expected, expect.any(File));
  });

  it("reduces a traversal filename to its basename so it cannot escape the lesson", async () => {
    await assetUpload({ file: pdf("../../1/lessons/2/evil.pdf"), lesson_id: "3" });

    const expected = buildCourseAssetPath(mod.course_id, lesson.module_id, 3, "evil.pdf");
    expect(uploadToStorage).toHaveBeenCalledWith("course_assets", expected, expect.any(File));
  });

  it("falls back to the extension name when the filename is only dots", async () => {
    await assetUpload({ file: pdf(".."), lesson_id: "3" });

    const expected = buildCourseAssetPath(mod.course_id, lesson.module_id, 3, "asset.pdf");
    expect(uploadToStorage).toHaveBeenCalledWith("course_assets", expected, expect.any(File));
  });

  it("resolves the course once and never re-queries the lesson's chain", async () => {
    await assetUpload({ file: pdf(), lesson_id: "3" });

    expect(findLessonModule).toHaveBeenCalledTimes(1);
    expect(findModuleCourse).toHaveBeenCalledTimes(1);
    expect(findCourseEvent).toHaveBeenCalledWith(expect.anything(), mod.course_id);
    expect(findCourseByLesson).not.toHaveBeenCalled();
  });

  it("403s an unassigned speaker without uploading", async () => {
    requireLessonAccess.mockResolvedValue(NextResponse403());

    const res = await assetUpload({ file: pdf(), lesson_id: "3" });

    expect(res.status).toBe(403);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("403s an unassigned facilitator without uploading", async () => {
    requireRole.mockResolvedValue(facilitator);
    requireLessonAccess.mockResolvedValue(NextResponse403());

    const res = await assetUpload({ file: pdf(), lesson_id: "3" });

    expect(res.status).toBe(403);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("403s a caller who fails the role floor before any query", async () => {
    requireRole.mockResolvedValue(denied);

    const res = await assetUpload({ file: pdf(), lesson_id: "3" });

    expect(res.status).toBe(403);
    expect(requireLessonAccess).not.toHaveBeenCalled();
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("400s an unknown lesson_id without uploading", async () => {
    findLessonModule.mockResolvedValue(null);

    const res = await assetUpload({ file: pdf(), lesson_id: "404" });

    expect(res.status).toBe(400);
    expect(uploadToStorage).not.toHaveBeenCalled();
    expect(requireLessonAccess).not.toHaveBeenCalled();
  });

  it("400s a missing lesson_id without uploading", async () => {
    const res = await assetUpload({ file: pdf() });

    expect(res.status).toBe(400);
    expect(findLessonModule).not.toHaveBeenCalled();
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("400s a disallowed file type before building the path", async () => {
    const html = new File(["<html/>"], "page.html", { type: "text/html" });

    const res = await assetUpload({ file: html, lesson_id: "3" });

    expect(res.status).toBe(400);
    expect(findLessonModule).not.toHaveBeenCalled();
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("400s an oversized file before building the path", async () => {
    validateFileSize.mockReturnValue(false);

    const res = await assetUpload({ file: pdf(), lesson_id: "3" });

    expect(res.status).toBe(400);
    expect(findLessonModule).not.toHaveBeenCalled();
    expect(uploadToStorage).not.toHaveBeenCalled();
  });
});

describe("POST /api/upload/course-video", () => {
  const mp4 = (name = "lecture.mp4") => new File(["x"], name, { type: "video/mp4" });

  it("uploads for an assigned speaker, deriving the path from the DAO chain", async () => {
    const res = await videoUpload({ file: mp4(), lesson_id: "3" });

    expect(res.status).toBe(200);
    const expected = buildCourseVideoPath(mod.course_id, lesson.module_id, 3, "lecture.mp4");
    expect(uploadToStorage).toHaveBeenCalledWith("course_videos", expected, expect.any(File));
  });

  it("reduces a traversal filename to its basename for videos too", async () => {
    await videoUpload({ file: mp4("../../../2/lessons/3/leak.mp4"), lesson_id: "3" });

    const expected = buildCourseVideoPath(mod.course_id, lesson.module_id, 3, "leak.mp4");
    expect(uploadToStorage).toHaveBeenCalledWith("course_videos", expected, expect.any(File));
  });

  it("403s an unassigned facilitator without uploading", async () => {
    requireRole.mockResolvedValue(facilitator);
    requireLessonAccess.mockResolvedValue(NextResponse403());

    const res = await videoUpload({ file: mp4(), lesson_id: "3" });

    expect(res.status).toBe(403);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("403s a caller who fails the role floor without uploading", async () => {
    requireRole.mockResolvedValue(denied);

    const res = await videoUpload({ file: mp4(), lesson_id: "3" });

    expect(res.status).toBe(403);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });

  it("400s an unknown lesson_id without uploading", async () => {
    findLessonModule.mockResolvedValue(null);

    const res = await videoUpload({ file: mp4(), lesson_id: "404" });

    expect(res.status).toBe(400);
    expect(uploadToStorage).not.toHaveBeenCalled();
  });
});
