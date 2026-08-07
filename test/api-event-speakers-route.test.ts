import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, speakerDao, logAuditEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  speakerDao: {
    isAssignedByUserId: vi.fn(),
    listEventAssignments: vi.fn(),
    assignToEvent: vi.fn(),
  },
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));

import { GET } from "@/app/api/events/[id]/speakers/route";

const ROSTER = [{ event_id: 1, speaker_profile_id: 7, SPEAKER_PROFILE: { id: 7, USER: { full_name: "Ada Lovelace" } } }];

const speaker = (role: string) => ({ allowed: true, error: null, user: { id: 5, role } });
const params = { params: Promise.resolve({ id: "9" }) };

beforeEach(() => {
  vi.clearAllMocks();
  speakerDao.listEventAssignments.mockResolvedValue(ROSTER);
  speakerDao.isAssignedByUserId.mockResolvedValue(true);
  speakerDao.assignToEvent.mockResolvedValue(true);
  logAuditEvent.mockResolvedValue(undefined);
});

describe("GET /api/events/[id]/speakers", () => {
  it("serves the roster to a speaker assigned to the event", async () => {
    requireRole.mockResolvedValue(speaker("speaker"));

    const res = await GET(new Request("https://app.test/api/events/9/speakers"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(ROSTER);
    expect(speakerDao.isAssignedByUserId).toHaveBeenCalledWith({}, 5, 9);
    expect(speakerDao.listEventAssignments).toHaveBeenCalledWith({}, 9);
  });

  it("refuses an unassigned speaker before reading the roster", async () => {
    requireRole.mockResolvedValue(speaker("speaker"));
    speakerDao.isAssignedByUserId.mockResolvedValue(false);

    const res = await GET(new Request("https://app.test/api/events/9/speakers"), params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    expect(speakerDao.listEventAssignments).not.toHaveBeenCalled();
  });

  it("lets staff through without the assignment check", async () => {
    requireRole.mockResolvedValue(speaker("facilitator"));

    const res = await GET(new Request("https://app.test/api/events/9/speakers"), params);

    expect(res.status).toBe(200);
    expect(speakerDao.isAssignedByUserId).not.toHaveBeenCalled();
  });

  it("refuses a caller below speaker", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await GET(new Request("https://app.test/api/events/9/speakers"), params);

    expect(res.status).toBe(403);
    expect(speakerDao.listEventAssignments).not.toHaveBeenCalled();
  });
});
