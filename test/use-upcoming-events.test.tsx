// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { useUpcomingEvents } from "@/modules/events/lib/use-upcoming-events";

// Exactly what GET /api/events?filter=upcoming serves: the EVENT row, whose
// primary key is `id`, with the course name still nested in the COURSE embed.
const apiRows = [
  {
    id: 41,
    title: "Alpha",
    event_date: "2026-08-12",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Hall A",
    status: "active",
    cover_image_url: null,
    COURSE: { course_name: "AI for Business" },
  },
  {
    id: 42,
    title: "Beta",
    event_date: "2026-08-20",
    start_time: "10:00:00",
    end_time: "18:00:00",
    venue_name: "Hall B",
    status: "active",
    cover_image_url: null,
    COURSE: null,
  },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: apiRows, total: apiRows.length, page: 1, limit: 50 }) }),
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useUpcomingEvents", () => {
  it("converts the API's `id` so every event carries a usable key and link target", async () => {
    const { result } = renderHook(() => useUpcomingEvents());

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events.map((e) => e.event_id)).toEqual([41, 42]);
  });

  it("flattens the COURSE embed the API nests", async () => {
    const { result } = renderHook(() => useUpcomingEvents());

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events.map((e) => e.course_name)).toEqual(["AI for Business", null]);
  });

  it("yields nothing when the request fails rather than a list of blanks", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, json: async () => [] }));

    const { result } = renderHook(() => useUpcomingEvents());

    await waitFor(() => expect(result.current.events).toEqual([]));
  });
});
