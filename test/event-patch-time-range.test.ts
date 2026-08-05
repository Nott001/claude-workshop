import { describe, it, expect, vi, beforeEach } from "vitest";
import { eventPartialSchema } from "@/modules/events/lib/schemas";

const { requireRole, findById, update, logAuditEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/modules/auth/lib/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/event.dao", () => ({ findById, update, findByIdWithRelations: vi.fn(), countAttendees: vi.fn() }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({}));
vi.mock("@/shared/db/dao/course.dao", () => ({}));

vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));

import { PATCH } from "@/app/api/events/[id]/route";

const facilitator = {
  allowed: true,
  error: null,
  user: { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com", profile_image_url: null },
};

const stored = { id: 3, title: "Launch", event_date: "2026-09-01", start_time: "09:00", end_time: "17:00" };

const patch = (body: unknown) =>
  PATCH(new Request("https://app.test/api/events/3", { method: "PATCH", body: JSON.stringify(body) }), {
    params: Promise.resolve({ id: "3" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(facilitator);
  findById.mockResolvedValue(stored);
  update.mockResolvedValue({ ...stored });
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

  it("does not query the stored event when no time is patched", async () => {
    const res = await patch({ title: "Renamed" });

    expect(res.status).toBe(200);
    expect(findById).not.toHaveBeenCalled();
  });
});
