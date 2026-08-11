import { describe, it, expect, vi, beforeEach } from "vitest";

const { findCourseScheduleByEvent, isPublished } = vi.hoisted(() => ({
  findCourseScheduleByEvent: vi.fn(),
  isPublished: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/course.dao", () => ({ findCourseScheduleByEvent }));
vi.mock("@/modules/events/db/event.dao", () => ({ isPublished }));

import { GET } from "@/app/api/events/[id]/schedule/route";

const get = (id = "1") => GET(new Request(`https://app.test/api/events/${id}/schedule`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  isPublished.mockResolvedValue(true);
});

describe("GET /api/events/[id]/schedule", () => {
  it("serves a flattened schedule with the speaker name pulled from the embed", async () => {
    findCourseScheduleByEvent.mockResolvedValue([
      {
        id: 1,
        module_name: "Intro",
        start_time: "09:00",
        end_time: "10:00",
        sequence_order: 1,
        speaker_profile_id: 7,
        SPEAKER_PROFILE: { USER: { full_name: "Ada Lovelace" } },
      },
    ]);

    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      modules: [{ id: 1, module_name: "Intro", start_time: "09:00", end_time: "10:00", speaker: "Ada Lovelace" }],
    });
  });

  it("answers a signed-out request without touching the session", async () => {
    findCourseScheduleByEvent.mockResolvedValue([]);

    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ modules: [] });
  });

  it("returns an empty list when the event has no course", async () => {
    findCourseScheduleByEvent.mockResolvedValue(null);

    const res = await get();

    await expect(res.json()).resolves.toEqual({ modules: [] });
  });

  it("sets speaker to null when the profile or its user is absent", async () => {
    findCourseScheduleByEvent.mockResolvedValue([
      {
        id: 2,
        module_name: "No speaker",
        start_time: null,
        end_time: null,
        sequence_order: 2,
        speaker_profile_id: null,
        SPEAKER_PROFILE: null,
      },
      {
        id: 3,
        module_name: "Missing user",
        start_time: null,
        end_time: null,
        sequence_order: 3,
        speaker_profile_id: 8,
        SPEAKER_PROFILE: { USER: null },
      },
    ]);

    const res = await get();

    await expect(res.json()).resolves.toEqual({
      modules: [
        { id: 2, module_name: "No speaker", start_time: null, end_time: null, speaker: null },
        { id: 3, module_name: "Missing user", start_time: null, end_time: null, speaker: null },
      ],
    });
  });

  it("answers an empty list for a draft event instead of leaking its course", async () => {
    isPublished.mockResolvedValue(false);
    findCourseScheduleByEvent.mockResolvedValue([
      {
        id: 1,
        module_name: "Secret module",
        start_time: "09:00",
        end_time: "10:00",
        sequence_order: 1,
        speaker_profile_id: null,
        SPEAKER_PROFILE: null,
      },
    ]);

    const res = await get();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ modules: [] });
    expect(findCourseScheduleByEvent).not.toHaveBeenCalled();
  });

  it("answers an empty list for an unknown event id", async () => {
    isPublished.mockResolvedValue(false);

    const res = await get("999");

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ modules: [] });
  });
});
