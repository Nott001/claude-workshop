import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, loadEventOr403, listEventAttendees } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadEventOr403: vi.fn(),
  listEventAttendees: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/lib/event-service", async () => {
  const errors = await vi.importActual<typeof import("@/modules/events/lib/event-errors")>("@/modules/events/lib/event-errors");
  return { ...errors, loadEventOr403, listEventAttendees };
});

import { GET } from "@/app/api/events/[id]/attendees/route";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/events/[id]/attendees", () => {
  it("returns 401 without a session and performs no lookups", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await GET(new Request("https://app.test/api/events/1/attendees"), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
    expect(loadEventOr403).not.toHaveBeenCalled();
    expect(listEventAttendees).not.toHaveBeenCalled();
  });
});
