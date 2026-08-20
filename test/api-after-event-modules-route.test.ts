import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireMinRole, canManageEvent, getSetting, setSetting, listModulesByEvent, logAuditEvent } = vi.hoisted(() => ({
  requireMinRole: vi.fn(),
  canManageEvent: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  listModulesByEvent: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireMinRole }));
vi.mock("@/modules/courses/lib/course-access", () => ({ canManageEvent }));
vi.mock("@/shared/db/dao/system-setting.dao", () => ({ getSetting, setSetting }));
vi.mock("@/shared/db/dao/course.dao", () => ({ listModulesByEvent }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent, requireAuditEvent: logAuditEvent }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

import { GET, PUT } from "@/app/api/events/[id]/after-event-modules/route";

const params = { params: Promise.resolve({ id: "12" }) };
const admin = { id: 9, role: ROLES.ADMIN };

const LESSON_MODULE = { id: 4, module_name: "Deep dive", module_type: "lessons", sequence_order: 2 };
const QA_MODULE = { id: 6, module_name: "Ask anything", module_type: "qa", sequence_order: 3 };

function put(body: unknown) {
  return new Request("https://app.test/api/events/12/after-event-modules", { method: "PUT", body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireMinRole.mockResolvedValue({ allowed: true, error: null, user: admin });
  canManageEvent.mockResolvedValue(true);
  getSetting.mockResolvedValue({ version: 1, releases: { "12": [4] } });
  setSetting.mockResolvedValue(true);
  listModulesByEvent.mockResolvedValue([LESSON_MODULE, QA_MODULE]);
  logAuditEvent.mockResolvedValue(true);
});

describe("GET /api/events/[id]/after-event-modules", () => {
  it("refuses a caller below the staff floor", async () => {
    requireMinRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    expect((await GET(new Request("https://app.test"), params)).status).toBe(403);
  });

  it("refuses staff who do not run this event", async () => {
    canManageEvent.mockResolvedValue(false);

    expect((await GET(new Request("https://app.test"), params)).status).toBe(403);
  });

  it("offers this event's own modules, and nothing from anywhere else", async () => {
    const res = await GET(new Request("https://app.test"), params);

    await expect(res.json()).resolves.toEqual({ module_ids: [4], modules: [LESSON_MODULE] });
    expect(listModulesByEvent).toHaveBeenCalledWith(expect.anything(), 12);
  });

  it("leaves Q&A modules out of the picker", async () => {
    // A Q&A module holds no material and its realtime read wants a live
    // session, so releasing one afterwards offers an empty, silent panel.
    const res = await GET(new Request("https://app.test"), params);
    const body = (await res.json()) as { modules: { id: number }[] };

    expect(body.modules.map((mod) => mod.id)).not.toContain(QA_MODULE.id);
  });
});

describe("PUT /api/events/[id]/after-event-modules", () => {
  it("refuses staff who do not run this event", async () => {
    canManageEvent.mockResolvedValue(false);

    expect((await PUT(put({ module_ids: [4] }), params)).status).toBe(403);
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("refuses a caller below the staff floor", async () => {
    requireMinRole.mockResolvedValue({ allowed: false, error: "Unauthenticated", user: null });

    expect((await PUT(put({ module_ids: [4] }), params)).status).toBe(401);
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("rejects a body the schema does not accept", async () => {
    const res = await PUT(put({ module_ids: ["four"] }), params);

    expect(res.status).toBe(400);
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("saves the release under the event's key, leaving other events alone", async () => {
    getSetting.mockResolvedValue({ version: 1, releases: { "12": [], "13": [9] } });

    const res = await PUT(put({ module_ids: [4] }), params);

    expect(res.status).toBe(200);
    expect(setSetting).toHaveBeenCalledWith(
      expect.anything(),
      "after_event_modules",
      { version: 1, releases: { "12": [4], "13": [9] } },
      9,
    );
  });

  it("clears the release when the list is emptied", async () => {
    await PUT(put({ module_ids: [] }), params);

    expect(setSetting).toHaveBeenCalledWith(expect.anything(), "after_event_modules", { version: 1, releases: {} }, 9);
  });

  it("refuses a module belonging to another event's course", async () => {
    // The map is keyed by the event whose ending releases the modules, so a
    // foreign id would release material on a clock that does not own it.
    const res = await PUT(put({ module_ids: [999] }), params);

    expect(res.status).toBe(400);
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("refuses a Q&A module even though it belongs to this event", async () => {
    const res = await PUT(put({ module_ids: [QA_MODULE.id] }), params);

    expect(res.status).toBe(400);
    expect(setSetting).not.toHaveBeenCalled();
  });

  it("reports a failed write instead of claiming the release saved", async () => {
    setSetting.mockResolvedValue(false);

    expect((await PUT(put({ module_ids: [4] }), params)).status).toBe(500);
  });

  it("records the change against the event", async () => {
    await PUT(put({ module_ids: [4] }), params);

    expect(logAuditEvent).toHaveBeenCalledWith(expect.anything(), 9, "event.updated", "event", 12, {
      after_event_module_ids: [4],
    });
  });
});
