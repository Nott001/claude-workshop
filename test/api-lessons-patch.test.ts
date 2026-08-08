import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { requireRole, requireLessonAccess, updateLesson, logAuditEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireLessonAccess: vi.fn(),
  updateLesson: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/modules/auth/lib/guard-response", () => ({
  guardFailure: (guard: { error: string }) => NextResponse.json({ error: guard.error }, { status: 403 }),
}));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => ({ updateLesson }));
vi.mock("@/shared/integrations/storage/service", () => ({ deleteFromStorage: vi.fn(), listStorageFolder: vi.fn() }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({ logAuditEvent }));
vi.mock("@/modules/courses/lib/course-access", () => ({ requireLessonAccess }));

import { PATCH } from "@/app/api/lessons/[id]/route";

const speaker = {
  allowed: true,
  error: null,
  user: { id: 8, role: ROLES.SPEAKER, full_name: "Sam", email: "sam@example.com", profile_image_url: null },
};

function jsonRequest(body: unknown): Request {
  return new Request("https://app.test/api/lessons/3", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(speaker);
  requireLessonAccess.mockResolvedValue(null);
  updateLesson.mockResolvedValue({ id: 3, module_id: 1, sequence_order: 1 });
});

describe("PATCH /api/lessons/[id]", () => {
  it("forwards a module_id when a lesson moves to another module", async () => {
    const res = await PATCH(
      jsonRequest({
        description: "Moved lesson",
        content_type: "pdf",
        sequence_order: 3,
        module_id: 5,
      }),
      { params: Promise.resolve({ id: "3" }) },
    );

    expect(res.status).toBe(200);
    expect(updateLesson).toHaveBeenCalledWith(expect.anything(), 3, {
      description: "Moved lesson",
      content_type: "pdf",
      sequence_order: 3,
      module_id: 5,
    });
  });

  it("omits module_id from the update when it is absent", async () => {
    const res = await PATCH(
      jsonRequest({
        description: "Renamed",
        content_type: "video",
        content_url: "https://example.com/v.mp4",
        sequence_order: 2,
      }),
      { params: Promise.resolve({ id: "3" }) },
    );

    expect(res.status).toBe(200);
    expect(updateLesson).toHaveBeenCalledWith(expect.anything(), 3, {
      description: "Renamed",
      content_type: "video",
      content_url: "https://example.com/v.mp4",
      sequence_order: 2,
    });
    expect(updateLesson.mock.calls[0][2]).not.toHaveProperty("module_id");
  });

  it("400s on an invalid body before touching the DAO", async () => {
    const res = await PATCH(jsonRequest({ description: "", content_type: "audio", sequence_order: 0 }), {
      params: Promise.resolve({ id: "3" }),
    });

    expect(res.status).toBe(400);
    expect(updateLesson).not.toHaveBeenCalled();
  });

  it("403s when the caller lacks access to the lesson", async () => {
    requireLessonAccess.mockResolvedValue(NextResponse.json({ error: "Forbidden" }, { status: 403 }));

    const res = await PATCH(jsonRequest({ description: "X", content_type: "link", sequence_order: 1 }), {
      params: Promise.resolve({ id: "3" }),
    });

    expect(res.status).toBe(403);
    expect(updateLesson).not.toHaveBeenCalled();
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("audits the change with the keys actually sent", async () => {
    await PATCH(jsonRequest({ description: "Renamed", content_type: "pdf", sequence_order: 2, module_id: 5 }), {
      params: Promise.resolve({ id: "3" }),
    });

    expect(logAuditEvent).toHaveBeenCalledWith(expect.anything(), 8, "lesson.updated", "lesson", 3, {
      changes: ["description", "content_type", "module_id", "sequence_order"],
    });
  });
});
