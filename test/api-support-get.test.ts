import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, listSupportMessages } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  listSupportMessages: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/chat.dao", () => ({ listSupportMessages }));

import { GET } from "@/app/api/support/route";

const ATTENDEE = { id: 12, role: ROLES.ATTENDEE };
const SPEAKER = { id: 7, role: ROLES.SPEAKER };

function get(url: string) {
  return GET(new Request(`https://app.test${url}`));
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(ATTENDEE);
  listSupportMessages.mockResolvedValue({
    messages: [],
    nextCursor: null,
    sessionActive: true,
    session: null,
  });
});

describe("GET /api/support", () => {
  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    expect((await get("/api/support")).status).toBe(401);
  });

  it("rejects an unknown support_type", async () => {
    expect((await get("/api/support?support_type=bogus")).status).toBe(400);
    expect(listSupportMessages).not.toHaveBeenCalled();
  });

  it("keeps speakers and facilitators out of the general queue", async () => {
    requireAuth.mockResolvedValue(SPEAKER);

    expect((await get("/api/support")).status).toBe(403);
  });

  it("hands an attendee their case number and handler name", async () => {
    listSupportMessages.mockResolvedValue({
      messages: [{ id: 1 }],
      nextCursor: null,
      sessionActive: true,
      session: {
        id: 10,
        status: "active",
        case_number: 100,
        assigned_to: 5,
        ASSIGNED: { full_name: "Boo" },
      },
    });

    const res = await get("/api/support");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      session_active: true,
      session: { id: 10, case_number: 100, assigned_to: 5, assigned_staff_name: "Boo" },
    });
    expect(listSupportMessages).toHaveBeenCalledWith({}, expect.objectContaining({ supportType: "general" }));
  });

  it("returns no session when the attendee has never chatted", async () => {
    const res = await get("/api/support");

    await expect(res.json()).resolves.toEqual({
      messages: [],
      nextCursor: null,
      session_active: true,
      session: null,
    });
  });
});
