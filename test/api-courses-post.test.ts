import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const { requireRole, canManageEvent, createCourse, logAuditEvent } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  canManageEvent: vi.fn(),
  createCourse: vi.fn(),
  logAuditEvent: vi.fn(),
}));

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole, requireMinRole: requireRole }));
vi.mock("@/modules/auth/lib/guard-response", () => ({
  guardFailure: (guard: { error: string }) => NextResponse.json({ error: guard.error }, { status: 403 }),
}));
vi.mock("@/modules/courses/lib/course-access", () => ({ canManageEvent }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => ({ createCourse }));
vi.mock("@/modules/audit/lib/log-audit-event", () => ({
  logAuditEvent,
  requireAuditEvent: vi.fn(async (...args: unknown[]) => logAuditEvent(...args)),
}));

import { POST } from "@/app/api/courses/route";

const speaker = {
  allowed: true,
  error: null,
  user: { id: 8, role: ROLES.SPEAKER, full_name: "Sam", email: "sam@example.com", profile_image_url: null },
};

function jsonRequest(body: unknown): Request {
  return new Request("https://app.test/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue(speaker);
  canManageEvent.mockResolvedValue(true);
  createCourse.mockResolvedValue({
    course: { id: 1, course_name: "Intro to React", course_description: null, event_id: 353 },
  });
});

describe("POST /api/courses", () => {
  it("creates a course with a null description, as the UI sends", async () => {
    const res = await POST(jsonRequest({ course_name: "Intro to React", course_description: null, event_id: 353 }));

    expect(res.status).toBe(201);
    expect(createCourse).toHaveBeenCalledWith(expect.anything(), {
      course_name: "Intro to React",
      course_description: null,
      event_id: 353,
    });
    expect(logAuditEvent).toHaveBeenCalledWith(expect.anything(), 8, "course.created", "course", 1, {
      name: "Intro to React",
    });
  });

  it("400s when the name is missing, without calling the dao", async () => {
    const res = await POST(jsonRequest({ course_description: null, event_id: 353 }));

    expect(res.status).toBe(400);
    expect(createCourse).not.toHaveBeenCalled();
  });

  it("403s a speaker who is not assigned to the event", async () => {
    canManageEvent.mockResolvedValue(false);

    const res = await POST(jsonRequest({ course_name: "Intro to React", course_description: null, event_id: 353 }));

    expect(res.status).toBe(403);
    expect(createCourse).not.toHaveBeenCalled();
  });

  it("409s when the event already owns a course, rather than reporting a server fault", async () => {
    createCourse.mockResolvedValue({ course: null, reason: "conflict" });

    const res = await POST(jsonRequest({ course_name: "Intro to React", course_description: null, event_id: 353 }));

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({ error: "This event already has a course" });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });

  it("500s when the insert failed for any other reason", async () => {
    createCourse.mockResolvedValue({ course: null, reason: "failed" });

    const res = await POST(jsonRequest({ course_name: "Intro to React", course_description: null, event_id: 353 }));

    expect(res.status).toBe(500);
  });
});
