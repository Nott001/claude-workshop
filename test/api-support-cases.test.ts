import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, listCases } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  listCases: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/chat.dao", () => ({ listCases }));

import { GET } from "@/app/api/support/cases/route";

const ATTENDEE = { id: 12, role: "attendee" };
const FACILITATOR = { id: 3, role: "facilitator" };
const ADMIN = { id: 1, role: "admin" };

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(ADMIN);
  listCases.mockResolvedValue([]);
});

describe("GET /api/support/cases", () => {
  it("refuses an attendee", async () => {
    requireAuth.mockResolvedValue(ATTENDEE);

    expect((await GET()).status).toBe(403);
    expect(listCases).not.toHaveBeenCalled();
  });

  it("refuses a facilitator — the case queue is an admin surface", async () => {
    requireAuth.mockResolvedValue(FACILITATOR);

    expect((await GET()).status).toBe(403);
  });

  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    expect((await GET()).status).toBe(403);
  });

  it("lists the open general cases for an admin", async () => {
    listCases.mockResolvedValue([{ id: 1, case_number: 100, user_id: 20, full_name: "Ana", assigned_to: null }]);

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      cases: [{ id: 1, case_number: 100, user_id: 20, full_name: "Ana", assigned_to: null }],
    });
    expect(listCases).toHaveBeenCalledWith({}, "general");
  });
});
