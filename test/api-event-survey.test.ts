import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, loadEventOr403, getStaffSurveyStatus, sendEventSurvey } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  loadEventOr403: vi.fn(),
  getStaffSurveyStatus: vi.fn(),
  sendEventSurvey: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/lib/event-service", async () => {
  const errors = await vi.importActual<typeof import("@/modules/events/lib/event-errors")>("@/modules/events/lib/event-errors");
  return { ...errors, loadEventOr403 };
});
vi.mock("@/modules/surveys/lib/survey-service", () => ({ getStaffSurveyStatus, sendEventSurvey }));

import { GET } from "@/app/api/events/[id]/survey/route";
import { POST } from "@/app/api/events/[id]/survey/send/route";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/events/[id]/survey", () => {
  it("returns 401 without a session and performs no lookups", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await GET(new Request("https://app.test/api/events/1/survey"), params("1"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
    expect(loadEventOr403).not.toHaveBeenCalled();
    expect(getStaffSurveyStatus).not.toHaveBeenCalled();
  });
});

describe("POST /api/events/[id]/survey/send", () => {
  it("returns 401 without a session and performs no lookups", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    const res = await POST(new Request("https://app.test/api/events/1/survey/send", { method: "POST" }), params("1"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthenticated" });
    expect(loadEventOr403).not.toHaveBeenCalled();
    expect(sendEventSurvey).not.toHaveBeenCalled();
  });
});
