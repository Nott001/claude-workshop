import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, requireAuth, speakerDao, logAuditEvent, eventFindById, facilitatorIsAssigned } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireAuth: vi.fn(),
  speakerDao: {
    isAssignedByUserId: vi.fn(),
    listEventAssignments: vi.fn(),
    assignToEvent: vi.fn(),
  },
  logAuditEvent: vi.fn(),
  eventFindById: vi.fn(),
  facilitatorIsAssigned: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/speaker.dao", () => speakerDao);
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ isAssigned: facilitatorIsAssigned }));
vi.mock("@/modules/events/db/event.dao", () => ({ findById: eventFindById }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));

import { GET, POST } from "@/app/api/events/[id]/speakers/route";

const ROSTER = [{ event_id: 1, speaker_profile_id: 7, SPEAKER_PROFILE: { id: 7, USER: { full_name: "Ada Lovelace" } } }];

const speaker = (role: string) => ({ allowed: true, error: null, user: { id: 5, role } });
const params = { params: Promise.resolve({ id: "9" }) };
const staffUser = (id: number, role: string) => ({
  id,
  role,
  full_name: "Fay",
  email: "fay@example.com",
  profile_image_url: null,
});

const post = () =>
  POST(
    new Request("https://app.test/api/events/9/speakers", { method: "POST", body: JSON.stringify({ speaker_profile_id: 7 }) }),
    params,
  );

beforeEach(() => {
  vi.clearAllMocks();
  speakerDao.listEventAssignments.mockResolvedValue(ROSTER);
  speakerDao.isAssignedByUserId.mockResolvedValue(true);
  speakerDao.assignToEvent.mockResolvedValue(true);
  logAuditEvent.mockResolvedValue(undefined);
  eventFindById.mockResolvedValue({ id: 9, status: "active" });
  facilitatorIsAssigned.mockResolvedValue(true);
});

describe("GET /api/events/[id]/speakers", () => {
  it("serves the roster to a speaker assigned to the event", async () => {
    requireRole.mockResolvedValue(speaker(ROLES.SPEAKER));

    const res = await GET(new Request("https://app.test/api/events/9/speakers"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(ROSTER);
    expect(speakerDao.isAssignedByUserId).toHaveBeenCalledWith({}, 5, 9);
    expect(speakerDao.listEventAssignments).toHaveBeenCalledWith({}, 9);
  });

  it("refuses an unassigned speaker before reading the roster", async () => {
    requireRole.mockResolvedValue(speaker(ROLES.SPEAKER));
    speakerDao.isAssignedByUserId.mockResolvedValue(false);

    const res = await GET(new Request("https://app.test/api/events/9/speakers"), params);

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    expect(speakerDao.listEventAssignments).not.toHaveBeenCalled();
  });

  it("lets staff through without the assignment check", async () => {
    requireRole.mockResolvedValue(speaker(ROLES.FACILITATOR));

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

describe("POST /api/events/[id]/speakers", () => {
  it("lets an assigned facilitator assign a speaker", async () => {
    requireAuth.mockResolvedValue(staffUser(9, ROLES.FACILITATOR));

    const res = await post();

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ success: true });
    expect(speakerDao.assignToEvent).toHaveBeenCalledWith({}, 9, 7);
    expect(logAuditEvent).toHaveBeenCalledWith({}, 9, "speaker.assigned", "speaker_profile", 7, { event_id: 9 });
  });

  it("refuses a facilitator who is not assigned to the event", async () => {
    requireAuth.mockResolvedValue(staffUser(9, ROLES.FACILITATOR));
    facilitatorIsAssigned.mockResolvedValue(false);

    const res = await post();

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    expect(speakerDao.assignToEvent).not.toHaveBeenCalled();
  });

  it("refuses a caller below facilitator", async () => {
    requireAuth.mockResolvedValue(staffUser(5, ROLES.ATTENDEE));

    const res = await post();

    expect(res.status).toBe(403);
    expect(speakerDao.assignToEvent).not.toHaveBeenCalled();
  });

  it("returns 401 for an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await post();

    expect(res.status).toBe(401);
    expect(speakerDao.assignToEvent).not.toHaveBeenCalled();
  });
});
