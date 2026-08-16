import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, getRouteClient, routeRpc } = vi.hoisted(() => {
  const routeRpc = vi.fn();
  return {
    requireAuth: vi.fn(),
    getRouteClient: vi.fn(async () => ({ rpc: routeRpc })),
    routeRpc,
  };
});

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/route-client", () => ({ getRouteClient }));

import { POST } from "@/app/api/auth/email/cancel/route";

const USER = {
  id: 1,
  role: ROLES.ATTENDEE,
  full_name: "Ada",
  email: "ada@example.com",
  profile_image_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(USER);
  routeRpc.mockResolvedValue({ data: null, error: null });
});

describe("POST /api/auth/email/cancel", () => {
  it("refuses an anonymous caller", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
    expect(routeRpc).not.toHaveBeenCalled();
  });

  it("calls the cancel helper and answers ok", async () => {
    const res = await POST();

    expect(routeRpc).toHaveBeenCalledWith("cancel_pending_email_change");
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
  });

  it("answers 500 when the provider RPC errors", async () => {
    routeRpc.mockResolvedValue({ data: null, error: { message: "function gone" } });

    const res = await POST();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: { status: 500, message: "function gone" },
    });
  });

  it("answers ok again on a repeat cancel", async () => {
    expect((await POST()).status).toBe(200);
    expect((await POST()).status).toBe(200);
    expect(routeRpc).toHaveBeenCalledTimes(2);
  });
});
