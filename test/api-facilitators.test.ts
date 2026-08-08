import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, listCandidates } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  listCandidates: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/modules/auth/lib/guard-response", () => ({
  guardFailure: (guard: { error: string }) => new Response(JSON.stringify({ error: guard.error }), { status: 403 }),
}));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ listCandidates }));

import { GET } from "@/app/api/facilitators/route";

const facilitator = {
  allowed: true,
  error: null,
  user: { id: 9, role: ROLES.FACILITATOR, full_name: "Fay", email: "fay@example.com", profile_image_url: null },
};
const denied = { allowed: false, error: "Forbidden", user: null };

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(facilitator);
  listCandidates.mockResolvedValue([]);
});

describe("GET /api/facilitators", () => {
  it("requires a facilitator-level caller", async () => {
    requireRole.mockResolvedValue(denied);

    const res = await GET();

    expect(res.status).toBe(403);
    expect(listCandidates).not.toHaveBeenCalled();
  });

  it("returns the roster of facilitator-role users", async () => {
    listCandidates.mockResolvedValue([
      { id: 3, full_name: "Fay Facilitator", email: "fay@example.com" },
      { id: 7, full_name: "Theo Facilitator", email: "theo@example.com" },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0]).toMatchObject({ id: 3, full_name: "Fay Facilitator" });
  });

  it("returns an empty list when no facilitators exist", async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual([]);
  });
});
