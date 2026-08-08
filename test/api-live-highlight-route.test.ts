import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, eventDao, liveSessionDao, courseDao } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  eventDao: { findById: vi.fn() },
  liveSessionDao: { getHighlightState: vi.fn(), upsertHighlightState: vi.fn() },
  courseDao: { findLessonById: vi.fn(), findModuleById: vi.fn(), findIdByEventId: vi.fn() },
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/modules/events/db/event.dao", () => eventDao);
vi.mock("@/modules/events/db/live-session.dao", () => liveSessionDao);
vi.mock("@/shared/db/dao/course.dao", () => courseDao);
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));

import { GET, POST, DELETE } from "@/app/api/events/[id]/live/highlight/route";

const params = { params: Promise.resolve({ id: "9" }) };
const SPEAKER = { id: 3, role: "speaker" };

function post(payload: unknown) {
  return new Request("https://app.test/api/events/9/live/highlight", { method: "POST", body: JSON.stringify(payload) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(SPEAKER);
  eventDao.findById.mockResolvedValue({ id: 9 });
  courseDao.findLessonById.mockResolvedValue({ id: 4, module_id: 11 });
  courseDao.findModuleById.mockResolvedValue({ id: 11, course_id: 7 });
  courseDao.findIdByEventId.mockResolvedValue(7);
  liveSessionDao.getHighlightState.mockResolvedValue(null);
  liveSessionDao.upsertHighlightState.mockResolvedValue({ highlighted_lesson_id: 4 });
});

describe("GET /api/events/[id]/live/highlight", () => {
  it("answers 404 for an event that does not exist", async () => {
    eventDao.findById.mockResolvedValue(null);

    const res = await GET(new Request("https://app.test/x"), params);

    expect(res.status).toBe(404);
  });

  it("reports nothing highlighted rather than failing when no row exists yet", async () => {
    const res = await GET(new Request("https://app.test/x"), params);

    await expect(res.json()).resolves.toEqual({
      highlighted_lesson_id: null,
      updated_by: null,
      updated_at: null,
      lesson: null,
    });
  });

  it("returns the highlighted lesson alongside its state", async () => {
    liveSessionDao.getHighlightState.mockResolvedValue({
      highlighted_lesson_id: 4,
      updated_by: 3,
      updated_at: "2026-08-05T00:00:00Z",
      LESSON: { id: 4, description: "Intro", content_type: "pdf" },
    });

    const res = await GET(new Request("https://app.test/x"), params);

    await expect(res.json()).resolves.toMatchObject({ highlighted_lesson_id: 4, lesson: { id: 4, description: "Intro" } });
  });
});

describe("POST /api/events/[id]/live/highlight", () => {
  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    const res = await POST(post({ lesson_id: 4 }), params);

    expect(res.status).toBe(401);
    expect(liveSessionDao.upsertHighlightState).not.toHaveBeenCalled();
  });

  it("refuses an attendee", async () => {
    requireAuth.mockResolvedValue({ id: 12, role: "attendee" });

    const res = await POST(post({ lesson_id: 4 }), params);

    expect(res.status).toBe(403);
    expect(liveSessionDao.upsertHighlightState).not.toHaveBeenCalled();
  });

  it("answers 404 for an event that does not exist", async () => {
    eventDao.findById.mockResolvedValue(null);

    const res = await POST(post({ lesson_id: 4 }), params);

    expect(res.status).toBe(404);
  });

  it("answers 404 for a lesson that does not exist", async () => {
    courseDao.findLessonById.mockResolvedValue(null);

    const res = await POST(post({ lesson_id: 4 }), params);

    expect(res.status).toBe(404);
    expect(liveSessionDao.upsertHighlightState).not.toHaveBeenCalled();
  });

  it("refuses to highlight a lesson belonging to another event's course", async () => {
    // Otherwise a speaker on one event could push their own material into
    // somebody else's live room.
    courseDao.findIdByEventId.mockResolvedValue(99);

    const res = await POST(post({ lesson_id: 4 }), params);

    expect(res.status).toBe(400);
    expect(liveSessionDao.upsertHighlightState).not.toHaveBeenCalled();
  });

  it("highlights a lesson from this event's own course", async () => {
    const res = await POST(post({ lesson_id: 4 }), params);

    expect(res.status).toBe(200);
    expect(liveSessionDao.upsertHighlightState).toHaveBeenCalledWith(
      expect.anything(),
      9,
      expect.objectContaining({ highlighted_lesson_id: 4, updated_by: 3 }),
    );
  });

  it("clears the highlight without checking a lesson when none is sent", async () => {
    const res = await POST(post({}), params);

    expect(res.status).toBe(200);
    expect(courseDao.findLessonById).not.toHaveBeenCalled();
    expect(liveSessionDao.upsertHighlightState).toHaveBeenCalledWith(
      expect.anything(),
      9,
      expect.objectContaining({ highlighted_lesson_id: null }),
    );
  });

  it("surfaces a failed write", async () => {
    liveSessionDao.upsertHighlightState.mockResolvedValue(null);

    const res = await POST(post({ lesson_id: 4 }), params);

    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/events/[id]/live/highlight", () => {
  it("refuses an attendee", async () => {
    requireAuth.mockResolvedValue({ id: 12, role: "attendee" });

    const res = await DELETE(new Request("https://app.test/x"), params);

    expect(res.status).toBe(403);
    expect(liveSessionDao.upsertHighlightState).not.toHaveBeenCalled();
  });

  it("clears the highlight", async () => {
    liveSessionDao.upsertHighlightState.mockResolvedValue({ highlighted_lesson_id: null });

    const res = await DELETE(new Request("https://app.test/x"), params);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ highlighted_lesson_id: null });
    expect(liveSessionDao.upsertHighlightState).toHaveBeenCalledWith(
      expect.anything(),
      9,
      expect.objectContaining({ highlighted_lesson_id: null, updated_by: 3 }),
    );
  });

  it("surfaces a failed write", async () => {
    liveSessionDao.upsertHighlightState.mockResolvedValue(null);

    const res = await DELETE(new Request("https://app.test/x"), params);

    expect(res.status).toBe(500);
  });
});
