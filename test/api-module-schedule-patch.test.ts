import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, dao, speakerDao, logAuditEvent, requireModuleAccess } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  dao: {
    findCourseByModule: vi.fn(),
    findModuleById: vi.fn(),
    findModulesByCourse: vi.fn(),
    updateModule: vi.fn(),
  },
  speakerDao: { checkSpeakerAssignment: vi.fn() },
  logAuditEvent: vi.fn(),
  requireModuleAccess: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => dao);
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));
vi.mock("@/modules/courses/lib/course-access", () => ({ requireModuleAccess }));

import { PATCH as patchModule } from "@/app/api/modules/[id]/route";

const SPEAKER = { allowed: true, error: null, user: { id: 5, role: ROLES.SPEAKER } };
const params = { params: Promise.resolve({ id: "11" }) };

const MODULE_BODY = { module_name: "Week one", sequence_order: 1 };

const MODULE_ROW = (id: number, module_name: string, times: { start_time: string | null; end_time: string | null }) => ({
  id,
  course_id: 7,
  module_name,
  sequence_order: id,
  start_time: times.start_time,
  end_time: times.end_time,
  speaker_profile_id: null,
});

function patch(payload: unknown) {
  return new Request("https://app.test/api/modules/11", { method: "PATCH", body: JSON.stringify(payload) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(SPEAKER);
  requireModuleAccess.mockResolvedValue(null);
  dao.findCourseByModule.mockResolvedValue({ id: 7, event_id: 9 });
  dao.findModuleById.mockResolvedValue({ id: 11, course_id: 7, start_time: null, end_time: null, speaker_profile_id: null });
  dao.findModulesByCourse.mockResolvedValue([]);
  dao.updateModule.mockResolvedValue({ id: 11, module_name: "Week one" });
  speakerDao.checkSpeakerAssignment.mockResolvedValue(true);
  logAuditEvent.mockResolvedValue(undefined);
});

describe("PATCH /api/modules/[id] speaker assignment", () => {
  it("rejects a speaker who is not assigned to the module's event", async () => {
    speakerDao.checkSpeakerAssignment.mockResolvedValue(false);

    const res = await patchModule(patch({ ...MODULE_BODY, speaker_profile_id: 7 }), params);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: { message: "Speaker is not assigned to this event" } });
    expect(dao.findCourseByModule).toHaveBeenCalledWith({}, 11);
    expect(speakerDao.checkSpeakerAssignment).toHaveBeenCalledWith({}, 7, 9);
    expect(dao.updateModule).not.toHaveBeenCalled();
  });

  it("accepts an assigned speaker", async () => {
    const res = await patchModule(patch({ ...MODULE_BODY, speaker_profile_id: 7 }), params);

    expect(res.status).toBe(200);
    expect(dao.updateModule).toHaveBeenCalledWith({}, 11, expect.objectContaining({ speaker_profile_id: 7 }));
  });

  it("clears a speaker without checking the assignment", async () => {
    const res = await patchModule(patch({ ...MODULE_BODY, speaker_profile_id: null }), params);

    expect(res.status).toBe(200);
    expect(speakerDao.checkSpeakerAssignment).not.toHaveBeenCalled();
    expect(dao.updateModule).toHaveBeenCalledWith({}, 11, expect.objectContaining({ speaker_profile_id: null }));
  });
});

describe("PATCH /api/modules/[id] time sessions", () => {
  it("rejects a window that would overlap another module, naming it", async () => {
    dao.findModulesByCourse.mockResolvedValue([
      MODULE_ROW(11, "Week one", { start_time: null, end_time: null }),
      MODULE_ROW(12, "Hands-on", { start_time: "09:30", end_time: "10:30" }),
    ]);

    const res = await patchModule(patch({ ...MODULE_BODY, start_time: "09:00", end_time: "10:00" }), params);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: { message: 'Time overlaps with "Hands-on"' } });
    expect(dao.updateModule).not.toHaveBeenCalled();
  });

  it("accepts a window that fits between the other modules", async () => {
    dao.findModulesByCourse.mockResolvedValue([
      MODULE_ROW(11, "Week one", { start_time: null, end_time: null }),
      MODULE_ROW(12, "Hands-on", { start_time: "11:00", end_time: "12:00" }),
    ]);

    const res = await patchModule(patch({ ...MODULE_BODY, start_time: "09:00", end_time: "10:00" }), params);

    expect(res.status).toBe(200);
    expect(dao.updateModule).toHaveBeenCalledWith({}, 11, expect.objectContaining({ start_time: "09:00", end_time: "10:00" }));
  });

  it("accepts a null clear of both times", async () => {
    const res = await patchModule(patch({ ...MODULE_BODY, start_time: null, end_time: null }), params);

    expect(res.status).toBe(200);
    expect(dao.updateModule).toHaveBeenCalledWith({}, 11, expect.objectContaining({ start_time: null, end_time: null }));
  });

  it("permits the edit when a pre-existing overlap does not involve the edited module", async () => {
    dao.findModulesByCourse.mockResolvedValue([
      MODULE_ROW(11, "Week one", { start_time: null, end_time: null }),
      MODULE_ROW(12, "Hands-on", { start_time: "09:00", end_time: "10:00" }),
      MODULE_ROW(13, "Wrap-up", { start_time: "09:30", end_time: "10:30" }),
    ]);

    const res = await patchModule(patch({ ...MODULE_BODY, start_time: "11:00", end_time: "12:00" }), params);

    expect(res.status).toBe(200);
    expect(dao.updateModule).toHaveBeenCalled();
  });
});
