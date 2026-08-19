import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireMinRole, listCases } = vi.hoisted(() => ({
  requireMinRole: vi.fn(),
  listCases: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireMinRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/chat.dao", () => ({ listCases }));

import { GET } from "@/app/api/support/cases/route";

const ADMIN = { id: 1, role: ROLES.ADMIN };

const req = () => new Request("https://app.test/support/cases");

const emptyPage = { data: [], total: 0, page: 1, limit: 50 };

beforeEach(() => {
  vi.clearAllMocks();
  requireMinRole.mockResolvedValue({ allowed: true, error: null, user: ADMIN });
  listCases.mockResolvedValue(emptyPage);
});

describe("GET /api/support/cases", () => {
  it("refuses an attendee", async () => {
    requireMinRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    expect((await GET(req())).status).toBe(403);
    expect(listCases).not.toHaveBeenCalled();
  });

  it("refuses a facilitator — the case queue is an admin surface", async () => {
    requireMinRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    expect((await GET(req())).status).toBe(403);
  });

  it("refuses a caller with no session", async () => {
    requireMinRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    expect((await GET(req())).status).toBe(401);
    expect(listCases).not.toHaveBeenCalled();
  });

  it("lists the open general cases for an admin", async () => {
    listCases.mockResolvedValue({
      data: [{ id: 1, case_number: 100, user_id: 20, full_name: "Ana", assigned_to: null }],
      total: 1,
      page: 1,
      limit: 50,
    });

    const res = await GET(req());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      data: [{ id: 1, case_number: 100, user_id: 20, full_name: "Ana", assigned_to: null }],
      total: 1,
      page: 1,
      limit: 50,
    });
    expect(listCases).toHaveBeenCalledWith({}, "general", { page: 1, limit: 50 });
  });
});
