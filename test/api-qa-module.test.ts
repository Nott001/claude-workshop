import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  requireAuth,
  requireRole,
  courseDao,
  facilitatorIsAssigned,
  speakerIsAssignedByUserId,
  listQuestionsByModule,
  sendQuestion,
} = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireRole: vi.fn(),
  courseDao: {
    findModuleById: vi.fn(),
    findCourseByModule: vi.fn(),
    findCourseEvent: vi.fn(),
    setModuleLock: vi.fn(),
  },
  facilitatorIsAssigned: vi.fn(),
  speakerIsAssignedByUserId: vi.fn(),
  listQuestionsByModule: vi.fn(),
  sendQuestion: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => courseDao);
vi.mock("@/shared/db/dao/facilitator.dao", () => ({ isAssigned: facilitatorIsAssigned }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ isAssignedByUserId: speakerIsAssignedByUserId }));
vi.mock("@/shared/db/dao/chat.dao", () => ({ qaMessageDao: { listQuestionsByModule, sendQuestion } }));

import { GET, POST, PATCH } from "@/app/api/qa/module/[moduleId]/route";
import { RATE_LIMIT_MAX } from "@/modules/chat/lib/rate-limit";

const params = { params: Promise.resolve({ moduleId: "4" }) };
const ATTENDEE = { id: 12, role: ROLES.ATTENDEE };
const QUESTION = { message: "How do I start?", module_id: 4 };
const QA_MODULE = { id: 4, module_type: "qa", is_locked: false, course_id: 7 };

function post(payload: unknown) {
  return new Request("https://app.test/api/qa/module/4", { method: "POST", body: JSON.stringify(payload) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(ATTENDEE);
  requireRole.mockResolvedValue({ allowed: true, error: null, user: { id: 3, role: ROLES.SPEAKER } });
  courseDao.findModuleById.mockResolvedValue(QA_MODULE);
  courseDao.findCourseByModule.mockResolvedValue({ id: 7, event_id: 9 });
  courseDao.findCourseEvent.mockResolvedValue({ id: 7, event_id: 9 });
  courseDao.setModuleLock.mockResolvedValue({ id: 4, is_locked: true });
  facilitatorIsAssigned.mockResolvedValue(false);
  speakerIsAssignedByUserId.mockResolvedValue(true);
  listQuestionsByModule.mockResolvedValue({ messages: [] });
  sendQuestion.mockResolvedValue({ id: 88, message: "How do I start?" });
});

describe("GET /api/qa/module/[moduleId]", () => {
  it("answers 404 for a module that does not exist", async () => {
    courseDao.findModuleById.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/qa/module/4"), params);

    expect(res.status).toBe(404);
    expect(requireAuth).not.toHaveBeenCalled();
  });

  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/api/qa/module/4"), params);

    expect(res.status).toBe(401);
    expect(listQuestionsByModule).not.toHaveBeenCalled();
  });

  it("returns the module's questions", async () => {
    listQuestionsByModule.mockResolvedValue({ messages: [{ id: 1, message: "Hi" }] });

    const res = await GET(new Request("https://app.test/api/qa/module/4"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ messages: [{ id: 1, message: "Hi" }] });
  });
});

describe("POST /api/qa/module/[moduleId]", () => {
  it("rejects an empty question before touching the database", async () => {
    const res = await POST(post({ message: "", module_id: 4 }), params);

    expect(res.status).toBe(400);
    expect(courseDao.findModuleById).not.toHaveBeenCalled();
  });

  it("refuses to take questions on a module that is not for Q&A", async () => {
    courseDao.findModuleById.mockResolvedValue({ ...QA_MODULE, module_type: "lessons" });

    const res = await POST(post(QUESTION), params);

    expect(res.status).toBe(400);
    expect(sendQuestion).not.toHaveBeenCalled();
  });

  it("refuses a locked Q&A", async () => {
    courseDao.findModuleById.mockResolvedValue({ ...QA_MODULE, is_locked: true });

    const res = await POST(post(QUESTION), params);

    expect(res.status).toBe(403);
    expect(sendQuestion).not.toHaveBeenCalled();
  });

  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await POST(post(QUESTION), params);

    expect(res.status).toBe(401);
  });

  it("slows down someone posting faster than the limit", async () => {
    listQuestionsByModule.mockResolvedValue({ messages: Array.from({ length: RATE_LIMIT_MAX }, (_, i) => ({ id: i })) });

    const res = await POST(post(QUESTION), params);

    expect(res.status).toBe(429);
    expect(sendQuestion).not.toHaveBeenCalled();
  });

  it("files the question against the event that owns the course", async () => {
    // The module knows its course; only the course knows the event, and the
    // message row is keyed on the event.
    const res = await POST(post(QUESTION), params);

    expect(res.status).toBe(201);
    expect(sendQuestion).toHaveBeenCalledWith({}, { event_id: 9, module_id: 4, user_id: 12, message: "How do I start?" });
  });

  it("answers 404 when the module points at a course that is gone", async () => {
    courseDao.findCourseEvent.mockResolvedValue(null);

    const res = await POST(post(QUESTION), params);

    expect(res.status).toBe(404);
    expect(sendQuestion).not.toHaveBeenCalled();
  });

  it("reports a message that did not save", async () => {
    sendQuestion.mockResolvedValue(null);

    const res = await POST(post(QUESTION), params);

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/qa/module/[moduleId]", () => {
  it("refuses a caller the guard turned away", async () => {
    requireRole.mockResolvedValue({ allowed: false, error: "Forbidden", user: null });

    const res = await PATCH(new Request("https://app.test/api/qa/module/4", { method: "PATCH", body: "{}" }), params);

    expect(res.status).toBe(403);
    expect(courseDao.setModuleLock).not.toHaveBeenCalled();
  });

  it("demands the lock state it is being asked to set", async () => {
    const res = await PATCH(new Request("https://app.test/api/qa/module/4", { method: "PATCH", body: "{}" }), params);

    expect(res.status).toBe(400);
    expect(courseDao.setModuleLock).not.toHaveBeenCalled();
  });

  it("locks the Q&A", async () => {
    const req = new Request("https://app.test/api/qa/module/4", { method: "PATCH", body: JSON.stringify({ is_locked: true }) });

    const res = await PATCH(req, params);

    expect(res.status).toBe(200);
    expect(courseDao.setModuleLock).toHaveBeenCalledWith({}, 4, true);
  });

  it("reports a lock that did not take", async () => {
    courseDao.setModuleLock.mockResolvedValue(null);
    const req = new Request("https://app.test/api/qa/module/4", {
      method: "PATCH",
      body: JSON.stringify({ is_locked: false }),
    });

    const res = await PATCH(req, params);

    expect(res.status).toBe(500);
  });
});
