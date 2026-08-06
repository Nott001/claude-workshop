import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const {
  requireAuth,
  requireRole,
  findModuleById,
  findCourseEvent,
  findCourseByModule,
  setModuleLock,
  checkAssignment,
  listQuestionsByModule,
  sendQuestion,
} = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  findModuleById: vi.fn(),
  findCourseEvent: vi.fn(),
  findCourseByModule: vi.fn(),
  setModuleLock: vi.fn(),
  checkAssignment: vi.fn(),
  listQuestionsByModule: vi.fn(),
  sendQuestion: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/modules/auth/lib/guard-response", () => ({
  guardFailure: (guard: { error: string }) => NextResponse.json({ error: guard.error }, { status: 403 }),
}));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => ({ findModuleById, findCourseEvent, findCourseByModule, setModuleLock }));
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ checkAssignment }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ isAssignedByUserId: vi.fn() }));
vi.mock("@/shared/db/dao/chat.dao", () => ({ qaMessageDao: { listQuestionsByModule, sendQuestion } }));

import { POST, PATCH } from "@/app/api/qa/module/[moduleId]/route";

const speaker = {
  allowed: true,
  error: null,
  user: { id: 8, role: "speaker", full_name: "Sam", email: "sam@example.com", profile_image_url: null },
};

// Module 2 is a qa module on course 1, whose event is 100.
const qaModule = { id: 2, course_id: 1, module_type: "qa", is_locked: false, sequence_order: 1 };
const course = { id: 1, event_id: 100 };

function jsonRequest(method: string, body: unknown): Request {
  return new Request("https://app.test/api/qa/module/2", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(speaker);
  requireAuth.mockResolvedValue({ id: 5, role: "attendee" });
  findModuleById.mockResolvedValue(qaModule);
  findCourseEvent.mockResolvedValue(course);
  findCourseByModule.mockResolvedValue(course);
  setModuleLock.mockResolvedValue({ ...qaModule, is_locked: true });
  checkAssignment.mockResolvedValue(false);
  listQuestionsByModule.mockResolvedValue({ messages: [] });
  sendQuestion.mockResolvedValue({ id: 9, module_id: 2, message: "hello" });
});

describe("POST /api/qa/module/[moduleId]", () => {
  it("answers on the course resolved from the module it already loaded", async () => {
    const res = await POST(jsonRequest("POST", { message: "hello", module_id: 2 }), {
      params: Promise.resolve({ moduleId: "2" }),
    });

    expect(res.status).toBe(201);
    expect(findCourseEvent).toHaveBeenCalledWith(expect.anything(), qaModule.course_id);
    expect(findCourseByModule).not.toHaveBeenCalled();
    expect(sendQuestion).toHaveBeenCalledWith(expect.anything(), {
      event_id: course.event_id,
      module_id: 2,
      user_id: 5,
      message: "hello",
    });
  });

  it("400s a message missing the module_id the schema requires", async () => {
    const res = await POST(jsonRequest("POST", { message: "hello" }), {
      params: Promise.resolve({ moduleId: "2" }),
    });

    expect(res.status).toBe(400);
    expect(sendQuestion).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/qa/module/[moduleId]", () => {
  it("403s an unassigned speaker without touching the lock", async () => {
    const res = await PATCH(jsonRequest("PATCH", { is_locked: true }), {
      params: Promise.resolve({ moduleId: "2" }),
    });

    expect(res.status).toBe(403);
    expect(setModuleLock).not.toHaveBeenCalled();
  });

  it("403s an unassigned facilitator without touching the lock", async () => {
    requireRole.mockResolvedValue({
      allowed: true,
      error: null,
      user: { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com", profile_image_url: null },
    });

    const res = await PATCH(jsonRequest("PATCH", { is_locked: true }), {
      params: Promise.resolve({ moduleId: "2" }),
    });

    expect(res.status).toBe(403);
    expect(setModuleLock).not.toHaveBeenCalled();
  });

  it("400s when is_locked is missing", async () => {
    requireRole.mockResolvedValue({
      allowed: true,
      error: null,
      user: { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com", profile_image_url: null },
    });
    checkAssignment.mockResolvedValue(true);

    const res = await PATCH(jsonRequest("PATCH", {}), { params: Promise.resolve({ moduleId: "2" }) });

    expect(res.status).toBe(400);
    expect(setModuleLock).not.toHaveBeenCalled();
  });

  it("flips the lock for an assigned facilitator", async () => {
    requireRole.mockResolvedValue({
      allowed: true,
      error: null,
      user: { id: 9, role: "facilitator", full_name: "Fay", email: "fay@example.com", profile_image_url: null },
    });
    checkAssignment.mockResolvedValue(true);

    const res = await PATCH(jsonRequest("PATCH", { is_locked: true }), {
      params: Promise.resolve({ moduleId: "2" }),
    });

    expect(res.status).toBe(200);
    expect(setModuleLock).toHaveBeenCalledWith(expect.anything(), 2, true);
  });
});
