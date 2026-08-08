import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, findByIdWithCourse, getAttendeeCount, facilitatorIsAssigned } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findByIdWithCourse: vi.fn(),
  getAttendeeCount: vi.fn(),
  facilitatorIsAssigned: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole: vi.fn() }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/db/event.dao", () => ({
  findByIdWithCourse,
  getAttendeeCount,
  findById: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({
  isAssigned: facilitatorIsAssigned,
  replaceEventAssignments: vi.fn(),
}));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ replaceEventAssignments: vi.fn() }));

import { GET } from "@/app/api/events/[id]/route";

const get = (id = "1") => GET(new Request(`https://app.test/api/events/${id}`), { params: Promise.resolve({ id }) });

const staffUser = (role: string) => ({
  id: 9,
  role,
  full_name: "Fay",
  email: "fay@example.com",
  profile_image_url: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  findByIdWithCourse.mockResolvedValue({
    id: 1,
    title: "Launch Day",
    event_date: "2026-09-01",
    start_time: "09:00",
    end_time: "17:00",
    status: "active",
    EVENT_FACILITATOR: [{ user_id: 9 }],
  });
  getAttendeeCount.mockResolvedValue(3);
  facilitatorIsAssigned.mockResolvedValue(true);
});

describe("GET /api/events/[id] facilitator assignment scoping", () => {
  it("admits a facilitator assigned to the event", async () => {
    requireAuth.mockResolvedValue(staffUser(ROLES.FACILITATOR));

    const res = await get();

    expect(res.status).toBe(200);
    expect(facilitatorIsAssigned).toHaveBeenCalledWith({}, 1, 9);
  });

  it("hides an event the facilitator is not assigned to", async () => {
    requireAuth.mockResolvedValue(staffUser(ROLES.FACILITATOR));
    facilitatorIsAssigned.mockResolvedValue(false);

    const res = await get();

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Event not found" });
  });

  it("does not consult the assignment roster for an admin", async () => {
    requireAuth.mockResolvedValue(staffUser(ROLES.ADMIN));

    const res = await get();

    expect(res.status).toBe(200);
    expect(facilitatorIsAssigned).not.toHaveBeenCalled();
  });

  it("still lets an attendee read a published event without an assignment check", async () => {
    requireAuth.mockResolvedValue(staffUser(ROLES.ATTENDEE));

    const res = await get();

    expect(res.status).toBe(200);
    expect(facilitatorIsAssigned).not.toHaveBeenCalled();
  });
});
