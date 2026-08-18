import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAuth,
  requireRole,
  listCommunityLinks,
  createCommunityLink,
  updateCommunityLink,
  deleteCommunityLink,
  ServiceError,
} = vi.hoisted(() => {
  class CommunityServiceError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
      this.name = "CommunityServiceError";
    }
  }
  return {
    requireAuth: vi.fn(),
    requireRole: vi.fn(),
    listCommunityLinks: vi.fn(),
    createCommunityLink: vi.fn(),
    updateCommunityLink: vi.fn(),
    deleteCommunityLink: vi.fn(),
    ServiceError: CommunityServiceError,
  };
});

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/community/lib/community-service", () => ({
  listCommunityLinks,
  createCommunityLink,
  updateCommunityLink,
  deleteCommunityLink,
  CommunityServiceError: ServiceError,
}));

import { GET, POST } from "@/app/api/community/route";
import { PATCH, DELETE } from "@/app/api/community/[id]/route";

const admin = {
  allowed: true,
  error: null,
  user: { id: 9, role: ROLES.ADMIN, full_name: "Adaeze", email: "ada@example.com", profile_image_url: null },
};
const denied = { allowed: false, error: "Forbidden", user: null };

const card = {
  id: 1,
  label: "StartupLab Facebook",
  url: "https://facebook.com/groups/startuplab",
  description: "The main group.",
  icon_url: null,
  sequence_order: 1,
  is_hidden: false,
  created_by: 9,
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
};

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue({
    id: 5,
    role: ROLES.ATTENDEE,
    full_name: "Jane",
    email: "jane@example.com",
    profile_image_url: null,
  });
  requireRole.mockResolvedValue(admin);
  listCommunityLinks.mockResolvedValue([card]);
  createCommunityLink.mockResolvedValue(card);
  updateCommunityLink.mockResolvedValue({ ...card, label: "Renamed" });
  deleteCommunityLink.mockResolvedValue(undefined);
});

describe("GET /api/community", () => {
  it("is role-aware: staff see every card, everyone else only the visible ones", async () => {
    const res = await GET(new Request("https://app.test/api/community"));

    expect(res.status).toBe(200);
    expect(listCommunityLinks).toHaveBeenCalledWith({}, ROLES.ATTENDEE);
  });

  it("passes a null role for an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/community"));

    expect(res.status).toBe(200);
    expect(listCommunityLinks).toHaveBeenCalledWith({}, null);
  });

  it("answers the cards the service returned", async () => {
    const res = await GET(new Request("https://app.test/api/community"));

    await expect(res.json()).resolves.toEqual([card]);
  });
});

describe("POST /api/community authorization", () => {
  it("refuses a caller who is not an admin", async () => {
    requireRole.mockResolvedValue(denied);

    const res = await POST(jsonRequest("https://app.test/api/community", "POST", { label: "X", url: "https://x.com" }));

    expect(res.status).toBe(403);
    expect(createCommunityLink).not.toHaveBeenCalled();
  });

  it("requires the admin role specifically", async () => {
    await POST(jsonRequest("https://app.test/api/community", "POST", { label: "X", url: "https://x.com" }));

    expect(requireRole).toHaveBeenCalledWith(ROLES.ADMIN);
  });
});

describe("POST /api/community validation", () => {
  it("rejects a body missing the required fields without writing", async () => {
    const res = await POST(jsonRequest("https://app.test/api/community", "POST", { label: "No url" }));

    expect(res.status).toBe(400);
    expect(createCommunityLink).not.toHaveBeenCalled();
  });

  it("rejects a url that is not a valid URL", async () => {
    const res = await POST(jsonRequest("https://app.test/api/community", "POST", { label: "X", url: "not-a-url" }));

    expect(res.status).toBe(400);
    expect(createCommunityLink).not.toHaveBeenCalled();
  });
});

describe("POST /api/community creation", () => {
  it("creates with the admin as the actor", async () => {
    const res = await POST(
      jsonRequest("https://app.test/api/community", "POST", {
        label: "WhatsApp",
        url: "https://chat.whatsapp.com/abc",
        description: "Daily updates",
      }),
    );

    expect(res.status).toBe(201);
    expect(createCommunityLink).toHaveBeenCalledWith({}, expect.objectContaining({ label: "WhatsApp" }), { id: 9 });
  });

  it("normalizes a blank icon_url to null instead of rejecting it", async () => {
    const res = await POST(
      jsonRequest("https://app.test/api/community", "POST", {
        label: "WhatsApp",
        url: "https://chat.whatsapp.com/abc",
        icon_url: "",
      }),
    );

    expect(res.status).toBe(201);
    expect(createCommunityLink).toHaveBeenCalledWith({}, expect.objectContaining({ icon_url: null }), { id: 9 });
  });

  it("returns 500 when the write fails", async () => {
    createCommunityLink.mockRejectedValue(new ServiceError(500, "Failed to create community link"));

    const res = await POST(jsonRequest("https://app.test/api/community", "POST", { label: "X", url: "https://x.com" }));

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/community/[id]", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("refuses a caller who is not an admin", async () => {
    requireRole.mockResolvedValue(denied);

    const res = await PATCH(jsonRequest("https://app.test/api/community/1", "PATCH", { label: "X" }), params("1"));

    expect(res.status).toBe(403);
    expect(updateCommunityLink).not.toHaveBeenCalled();
  });

  it("forwards the patch to the service for the given id", async () => {
    const res = await PATCH(jsonRequest("https://app.test/api/community/1", "PATCH", { label: "Renamed" }), params("1"));

    expect(res.status).toBe(200);
    expect(updateCommunityLink).toHaveBeenCalledWith({}, 1, { label: "Renamed" });
  });

  it("accepts an is_hidden toggle", async () => {
    const res = await PATCH(jsonRequest("https://app.test/api/community/1", "PATCH", { is_hidden: true }), params("1"));

    expect(res.status).toBe(200);
    expect(updateCommunityLink).toHaveBeenCalledWith({}, 1, { is_hidden: true });
  });

  it("accepts a sequence_order reorder", async () => {
    const res = await PATCH(jsonRequest("https://app.test/api/community/1", "PATCH", { sequence_order: 3 }), params("1"));

    expect(res.status).toBe(200);
    expect(updateCommunityLink).toHaveBeenCalledWith({}, 1, { sequence_order: 3 });
  });

  it("rejects an invalid body before touching the service", async () => {
    const res = await PATCH(jsonRequest("https://app.test/api/community/1", "PATCH", { url: "broken" }), params("1"));

    expect(res.status).toBe(400);
    expect(updateCommunityLink).not.toHaveBeenCalled();
  });

  it("answers 404 when the card does not exist", async () => {
    updateCommunityLink.mockRejectedValue(new ServiceError(404, "Community link not found"));

    const res = await PATCH(jsonRequest("https://app.test/api/community/999", "PATCH", { label: "X" }), params("999"));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Community link not found" });
  });
});

describe("DELETE /api/community/[id]", () => {
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("refuses a caller who is not an admin", async () => {
    requireRole.mockResolvedValue(denied);

    const res = await DELETE(new Request("https://app.test/api/community/1", { method: "DELETE" }), params("1"));

    expect(res.status).toBe(403);
    expect(deleteCommunityLink).not.toHaveBeenCalled();
  });

  it("deletes the card with the given id", async () => {
    const res = await DELETE(new Request("https://app.test/api/community/1", { method: "DELETE" }), params("1"));

    expect(res.status).toBe(200);
    expect(deleteCommunityLink).toHaveBeenCalledWith({}, 1);
  });
});
