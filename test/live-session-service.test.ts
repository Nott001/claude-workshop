import { describe, it, expect, vi, beforeEach } from "vitest";

const { courseDao, liveSessionDao } = vi.hoisted(() => ({
  courseDao: {
    findCourseById: vi.fn(),
    findLessonById: vi.fn(),
    findModuleById: vi.fn(),
  },
  liveSessionDao: {
    findStateWithLesson: vi.fn(),
    setHighlight: vi.fn(),
  },
}));

vi.mock("@/shared/db/dao/course.dao", () => courseDao);
vi.mock("@/modules/courses/db/live-session.dao", () => liveSessionDao);

import { getCourseHighlight, setCourseHighlight, clearCourseHighlight } from "@/modules/courses/lib/live-session-service";
import type { DbClient } from "@/shared/db/dao/types";

const client = {} as unknown as DbClient;
const ACTOR = { id: 3 };

function resolveCourse() {
  courseDao.findCourseById.mockResolvedValue({ id: 4, event_id: 9, course_name: "Intro", course_description: null });
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveCourse();
  courseDao.findLessonById.mockResolvedValue({ id: 7, module_id: 2 });
  courseDao.findModuleById.mockResolvedValue({ id: 2, course_id: 4 });
  liveSessionDao.findStateWithLesson.mockResolvedValue(null);
  liveSessionDao.setHighlight.mockResolvedValue({
    data: { course_id: 4, highlighted_lesson_id: 7, updated_by: 3, updated_at: "2026-08-05T00:00:00Z" },
    error: null,
  });
});

describe("getCourseHighlight", () => {
  it("refuses a course that does not exist", async () => {
    courseDao.findCourseById.mockResolvedValue(null);

    await expect(getCourseHighlight(client, 4)).rejects.toMatchObject({ status: 404 });
  });

  it("reports nothing highlighted when no state row exists yet", async () => {
    await expect(getCourseHighlight(client, 4)).resolves.toEqual({
      highlighted_lesson_id: null,
      updated_by: null,
      updated_at: null,
      lesson: null,
    });
  });

  it("returns the highlighted lesson alongside its state", async () => {
    liveSessionDao.findStateWithLesson.mockResolvedValue({
      highlighted_lesson_id: 7,
      updated_by: 3,
      updated_at: "2026-08-05T00:00:00Z",
      LESSON: { id: 7, description: "Intro", content_type: "pdf" },
    });

    await expect(getCourseHighlight(client, 4)).resolves.toMatchObject({
      highlighted_lesson_id: 7,
      lesson: { id: 7, description: "Intro" },
    });
  });
});

describe("setCourseHighlight", () => {
  it("refuses a course that does not exist", async () => {
    courseDao.findCourseById.mockResolvedValue(null);

    await expect(setCourseHighlight(client, 4, 7, ACTOR)).rejects.toMatchObject({ status: 404 });
    expect(liveSessionDao.setHighlight).not.toHaveBeenCalled();
  });

  it("refuses a lesson that does not exist", async () => {
    courseDao.findLessonById.mockResolvedValue(null);

    await expect(setCourseHighlight(client, 4, 7, ACTOR)).rejects.toMatchObject({ status: 404 });
    expect(liveSessionDao.setHighlight).not.toHaveBeenCalled();
  });

  it("refuses a lesson owned by another course", async () => {
    courseDao.findModuleById.mockResolvedValue({ id: 2, course_id: 99 });

    await expect(setCourseHighlight(client, 4, 7, ACTOR)).rejects.toMatchObject({ status: 400 });
    expect(liveSessionDao.setHighlight).not.toHaveBeenCalled();
  });

  it("writes the highlight with the acting user stamped on the row", async () => {
    const result = await setCourseHighlight(client, 4, 7, ACTOR);

    expect(result).toMatchObject({ highlighted_lesson_id: 7 });
    expect(liveSessionDao.setHighlight).toHaveBeenCalledWith(client, 4, 7, 3);
  });

  it("skips the lesson lookups when clearing so a stale highlight can be lifted", async () => {
    await setCourseHighlight(client, 4, null, ACTOR);

    expect(courseDao.findLessonById).not.toHaveBeenCalled();
    expect(liveSessionDao.setHighlight).toHaveBeenCalledWith(client, 4, null, 3);
  });

  it("surfaces a failed write", async () => {
    liveSessionDao.setHighlight.mockResolvedValue({ data: null, error: { message: "no", code: "500" } });

    await expect(setCourseHighlight(client, 4, 7, ACTOR)).rejects.toMatchObject({ status: 500 });
  });
});

describe("clearCourseHighlight", () => {
  it("lifts the highlight without consulting the course", async () => {
    courseDao.findCourseById.mockResolvedValue(null);

    await expect(clearCourseHighlight(client, 4, ACTOR)).resolves.toEqual({ highlighted_lesson_id: null });
    expect(liveSessionDao.setHighlight).toHaveBeenCalledWith(client, 4, null, 3);
  });

  it("surfaces a failed write", async () => {
    liveSessionDao.setHighlight.mockResolvedValue({ data: null, error: { message: "no", code: "500" } });

    await expect(clearCourseHighlight(client, 4, ACTOR)).rejects.toMatchObject({ status: 500 });
  });
});
