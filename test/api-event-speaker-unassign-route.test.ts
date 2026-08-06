import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, speakerDao, courseDao, logAuditEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  speakerDao: {
    unassignFromEvent: vi.fn(),
  },
  courseDao: {
    clearModuleSpeakerForEvent: vi.fn(),
  },
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/shared/db/dao/course.dao", () => courseDao);
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));

import { DELETE } from "@/app/api/events/[id]/speakers/[profileId]/route";

const facilitator = { allowed: true, error: null, user: { id: 5, role: "facilitator" } };
const params = { params: Promise.resolve({ id: "9", profileId: "7" }) };

beforeEach(() => {
  vi.clearAllMocks();
  speakerDao.unassignFromEvent.mockResolvedValue(true);
  courseDao.clearModuleSpeakerForEvent.mockResolvedValue(true);
  logAuditEvent.mockResolvedValue(undefined);
});

describe("DELETE /api/events/[id]/speakers/[profileId]", () => {
  it("clears the module speaker reference when a facilitator unassigns", async () => {
    requireRole.mockResolvedValue(facilitator);

    const res = await DELETE(new Request("https://app.test/api/events/9/speakers/7"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(speakerDao.unassignFromEvent).toHaveBeenCalledWith({}, 9, 7);
    expect(courseDao.clearModuleSpeakerForEvent).toHaveBeenCalledWith({}, 9, 7);
    expect(logAuditEvent).toHaveBeenCalledWith({}, 5, "speaker.unassigned", "speaker_profile", 7, { event_id: 9 });
  });

  it("does not touch modules when the unassign fails", async () => {
    requireRole.mockResolvedValue(facilitator);
    speakerDao.unassignFromEvent.mockResolvedValue(false);

    const res = await DELETE(new Request("https://app.test/api/events/9/speakers/7"), params);

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to unassign speaker" });
    expect(courseDao.clearModuleSpeakerForEvent).not.toHaveBeenCalled();
  });

  it("refuses a caller below facilitator without touching the database", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await DELETE(new Request("https://app.test/api/events/9/speakers/7"), params);

    expect(res.status).toBe(403);
    expect(speakerDao.unassignFromEvent).not.toHaveBeenCalled();
    expect(courseDao.clearModuleSpeakerForEvent).not.toHaveBeenCalled();
  });
});
