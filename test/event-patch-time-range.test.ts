import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventPartialSchema } from "@/modules/events/lib/schemas";

const { findById, update, logAuditEvent, facilitatorReplace, speakerReplace, facilitatorIsAssigned, requireAuth } = vi.hoisted(
  () => ({
    findById: vi.fn(),
    update: vi.fn(),
    logAuditEvent: vi.fn(),
    facilitatorReplace: vi.fn(),
    speakerReplace: vi.fn(),
    facilitatorIsAssigned: vi.fn(),
    requireAuth: vi.fn(),
  }),
);

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/db/event.dao", () => ({ findById, update, findByIdWithRelations: vi.fn(), countAttendees: vi.fn() }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({}));
vi.mock("@/shared/db/dao/course.dao", () => ({}));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({
  replaceEventAssignments: facilitatorReplace,
  isAssigned: facilitatorIsAssigned,
}));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ replaceEventAssignments: speakerReplace }));

vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));

import { PATCH } from "@/app/api/events/[id]/route";

const user = { id: 9, role: ROLES.ADMIN, full_name: "Alex", email: "alex@example.com", profile_image_url: null };
const facilitator = { id: 10, role: ROLES.FACILITATOR, full_name: "Fay", email: "fay@example.com", profile_image_url: null };

const stored = { id: 3, title: "Launch", event_date: "2026-09-01", start_time: "09:00", end_time: "17:00" };

const patch = (body: unknown) =>
  PATCH(new Request("https://app.test/api/events/3", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "3" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(user);
  findById.mockResolvedValue(stored);
  update.mockResolvedValue({ ...stored });
  facilitatorReplace.mockResolvedValue(true);
  speakerReplace.mockResolvedValue(true);
  facilitatorIsAssigned.mockResolvedValue(true);
});

describe("eventPartialSchema", () => {
  // `.partial()` drops the base schema's refinement, so the inverted range used
  // to reach the database and turn a 400 into a 500 via chk_event_time.
  it("rejects an inverted range when the patch carries both ends", () => {
    const result = eventPartialSchema.safeParse({ start_time: "18:00", end_time: "09:00" });
    expect(result.success).toBe(false);
  });

  it("accepts a valid range", () => {
    expect(eventPartialSchema.safeParse({ start_time: "09:00", end_time: "18:00" }).success).toBe(true);
  });

  it("still accepts a patch that touches neither time", () => {
    expect(eventPartialSchema.safeParse({ title: "Renamed" }).success).toBe(true);
  });
});

describe("PATCH /api/events/[id] time range", () => {
  it("returns 400, not 500, for an inverted range", async () => {
    const res = await patch({ start_time: "18:00", end_time: "09:00" });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  // A one-sided patch cannot be judged by the schema alone; it is checked
  // against the end it leaves alone.
  it("rejects an end_time moved before the stored start_time", async () => {
    const res = await patch({ end_time: "08:00" });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("rejects a start_time moved after the stored end_time", async () => {
    const res = await patch({ start_time: "23:00" });

    expect(res.status).toBe(400);
    expect(update).not.toHaveBeenCalled();
  });

  it("accepts a one-sided patch that keeps the range valid", async () => {
    const res = await patch({ end_time: "18:00" });

    expect(res.status).toBe(200);
    expect(update).toHaveBeenCalled();
  });

  it("does not re-read the event for a range check when no time is patched", async () => {
    const res = await patch({ title: "Renamed" });

    expect(res.status).toBe(200);
    // The single read is the authorization guard's; a time-free patch cannot
    // trip the stored-range check updateEvent would otherwise perform.
    expect(findById).toHaveBeenCalledTimes(1);
  });
});

describe("PATCH /api/events/[id] authorization", () => {
  it("refuses a facilitator even when assigned to the event", async () => {
    requireAuth.mockResolvedValue(facilitator);
    facilitatorIsAssigned.mockResolvedValue(true);

    const res = await patch({ title: "Renamed" });

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Forbidden" });
    expect(update).not.toHaveBeenCalled();
  });

  it("refuses a caller below admin", async () => {
    requireAuth.mockResolvedValue({ ...user, role: ROLES.ATTENDEE });

    const res = await patch({ title: "Renamed" });

    expect(res.status).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it("returns 401 for an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await patch({ title: "Renamed" });

    expect(res.status).toBe(401);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/events/[id] assignment sync", () => {
  it("skips both join-table syncs when the patch carries neither roster", async () => {
    const res = await patch({ title: "Renamed" });

    expect(res.status).toBe(200);
    expect(facilitatorReplace).not.toHaveBeenCalled();
    expect(speakerReplace).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({}, 3, { title: "Renamed" });
  });

  it("syncs speaker_profile_ids and keeps them out of the EVENT update", async () => {
    const res = await patch({ speaker_profile_ids: [4, 8] });

    expect(res.status).toBe(200);
    expect(speakerReplace).toHaveBeenCalledWith({}, 3, [4, 8]);
    expect(update).toHaveBeenCalledWith({}, 3, {});
  });

  it("returns 500 and writes nothing when the speaker sync fails", async () => {
    speakerReplace.mockResolvedValue(false);

    const res = await patch({ speaker_profile_ids: [4] });

    expect(res.status).toBe(500);
    expect(update).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
});
