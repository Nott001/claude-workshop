import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import {
  CourseModuleServiceError,
  deleteModuleWithStorage,
  setModuleLock,
  updateModule,
} from "@/modules/courses/lib/course-module-service";

const { dao, speakerDao, storage, logAuditEvent } = vi.hoisted(() => ({
  dao: {
    setModuleLock: vi.fn(),
    findCourseByModule: vi.fn(),
    findModuleById: vi.fn(),
    findModulesByCourse: vi.fn(),
    updateModule: vi.fn(),
    findLessonsByModule: vi.fn(),
    deleteModule: vi.fn(),
  },
  speakerDao: { checkSpeakerAssignment: vi.fn() },
  storage: { listStorageFolder: vi.fn(), deleteFromStorage: vi.fn() },
  logAuditEvent: vi.fn(),
}));

vi.mock("@/shared/db/dao/course.dao", () => dao);
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/shared/integrations/storage/service", () => storage);
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));

const supabase = {} as unknown as DbClient;

beforeEach(() => {
  vi.clearAllMocks();
  dao.setModuleLock.mockResolvedValue({ id: 11, is_locked: true });
  dao.findCourseByModule.mockResolvedValue({ id: 7, event_id: 3 });
  speakerDao.checkSpeakerAssignment.mockResolvedValue(true);
  dao.findModuleById.mockResolvedValue({ id: 11, course_id: 7, start_time: "09:00:00", end_time: "10:00:00" });
  dao.findModulesByCourse.mockResolvedValue([{ id: 11, module_name: "A", start_time: "09:00:00", end_time: "10:00:00" }]);
  dao.updateModule.mockResolvedValue({ id: 11, module_name: "Week one" });
  dao.findLessonsByModule.mockResolvedValue([]);
  dao.deleteModule.mockResolvedValue(true);
  storage.listStorageFolder.mockResolvedValue([]);
  storage.deleteFromStorage.mockResolvedValue(undefined);
  logAuditEvent.mockResolvedValue(undefined);
});

describe("setModuleLock", () => {
  it("locks a module and returns it", async () => {
    const mod = await setModuleLock(supabase, 11, true);

    expect(mod).toEqual({ id: 11, is_locked: true });
    expect(dao.setModuleLock).toHaveBeenCalledWith({}, 11, true);
  });

  it("reports a lock that did not take", async () => {
    dao.setModuleLock.mockResolvedValue(null);

    await expect(setModuleLock(supabase, 11, false)).rejects.toMatchObject({ status: 500 });
  });
});

describe("updateModule", () => {
  it("renames a module and records it", async () => {
    const mod = await updateModule(supabase, 11, { module_name: "Week one", sequence_order: 1, module_type: "lessons" }, 5);

    expect(mod).toEqual({ id: 11, module_name: "Week one" });
    expect(dao.updateModule).toHaveBeenCalledWith({}, 11, {
      module_name: "Week one",
      sequence_order: 1,
    });
    expect(logAuditEvent).toHaveBeenCalledWith({}, 5, "module.updated", "module", 11, expect.anything());
  });

  it("rejects a speaker who is not assigned to the module's event", async () => {
    speakerDao.checkSpeakerAssignment.mockResolvedValue(false);

    await expect(
      updateModule(
        supabase,
        11,
        { module_name: "Week one", sequence_order: 1, module_type: "lessons", speaker_profile_id: 9 },
        5,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(dao.updateModule).not.toHaveBeenCalled();
  });

  it("accepts a speaker assigned to the module's event", async () => {
    await updateModule(
      supabase,
      11,
      { module_name: "Week one", sequence_order: 1, module_type: "lessons", speaker_profile_id: 9 },
      5,
    );

    expect(dao.updateModule).toHaveBeenCalledWith({}, 11, expect.objectContaining({ speaker_profile_id: 9 }));
  });

  it("refuses an edit that collides with a sibling session", async () => {
    dao.findModulesByCourse.mockResolvedValue([
      { id: 11, module_name: "A", start_time: "09:00:00", end_time: "10:00:00" },
      { id: 12, module_name: "B", start_time: "09:30:00", end_time: "11:00:00" },
    ]);

    await expect(
      updateModule(supabase, 11, { module_name: "A", sequence_order: 1, module_type: "lessons", end_time: "11:00" }, 5),
    ).rejects.toMatchObject({ status: 400, message: 'Time overlaps with "B"' });
    expect(dao.updateModule).not.toHaveBeenCalled();
  });

  it("allows an edit that touches only one end of a still-valid window", async () => {
    await updateModule(supabase, 11, { module_name: "A", sequence_order: 1, module_type: "lessons", start_time: "08:00" }, 5);

    // Only the edited edge is forwarded; the untouched one reaches the DAO as
    // undefined, which its update filters out rather than overwriting.
    expect(dao.updateModule).toHaveBeenCalledWith({}, 11, {
      module_name: "A",
      sequence_order: 1,
      start_time: "08:00",
      end_time: undefined,
    });
  });

  it("reports a failed write instead of a success", async () => {
    dao.updateModule.mockResolvedValue(null);

    await expect(
      updateModule(supabase, 11, { module_name: "Week one", sequence_order: 1, module_type: "lessons" }, 5),
    ).rejects.toMatchObject({
      status: 500,
    });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("deleteModuleWithStorage", () => {
  it("clears each lesson's uploads under the module's own course before deleting", async () => {
    dao.findLessonsByModule.mockResolvedValue([{ id: 22 }]);
    storage.listStorageFolder.mockResolvedValue(["courses/7/modules/11/lessons/22/slides.pdf"]);

    const result = await deleteModuleWithStorage(supabase, 11, 5);

    expect(result).toEqual({ success: true });
    expect(storage.listStorageFolder).toHaveBeenCalledWith("course_assets", "courses/7/modules/11/lessons/22");
    expect(storage.deleteFromStorage).toHaveBeenCalledWith("course_videos", expect.any(Array));
    expect(dao.deleteModule).toHaveBeenCalledWith({}, 11);
  });

  it("reports a failed delete and records nothing", async () => {
    dao.deleteModule.mockResolvedValue(false);

    await expect(deleteModuleWithStorage(supabase, 11, 5)).rejects.toMatchObject({ status: 500 });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});

describe("CourseModuleServiceError", () => {
  it("carries the status a route maps to NextResponse", () => {
    const err = new CourseModuleServiceError(400, "Speaker is not assigned to this event");

    expect(err.status).toBe(400);
    expect(err.message).toBe("Speaker is not assigned to this event");
  });
});
