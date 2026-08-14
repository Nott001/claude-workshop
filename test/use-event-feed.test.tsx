// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { useEventFeed } from "@/modules/events/lib/use-event-feed";

// Exactly what GET /api/events serves: the EVENT row, whose primary key is
// `id`, with the course name still nested in the COURSE embed.
const apiRows = [
  {
    id: 41,
    title: "Alpha",
    event_date: "2026-08-12",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Hall A",
    status: "complete",
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
    status: "complete",
    cover_image_url: null,
    COURSE: null,
  },
];

function stubFetch(rows: unknown = apiRows, ok = true) {
  const fetchMock = vi.fn().mockResolvedValue({ ok, json: async () => ({ data: rows }) });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useEventFeed", () => {
  it("asks the API for the window and the count the caller wants", async () => {
    const fetchMock = stubFetch();

    renderHook(() => useEventFeed("past", 3));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("filter=past");
    expect(url).toContain("limit=3");
  });

  // The limit is spent at the API rather than on the response, so a caller
  // asking for three must not be served a page of fifty and told to slice.
  it("takes the rows the API returns without trimming them again", async () => {
    stubFetch();

    const { result } = renderHook(() => useEventFeed("past", 3));

    await waitFor(() => expect(result.current.events).toHaveLength(2));
  });

  it("converts the API's `id` so every event carries a usable key and link target", async () => {
    stubFetch();

    const { result } = renderHook(() => useEventFeed("past", 3));

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events.map((e) => e.event_id)).toEqual([41, 42]);
  });

  it("flattens the COURSE embed the API nests", async () => {
    stubFetch();

    const { result } = renderHook(() => useEventFeed("upcoming", 2));

    await waitFor(() => expect(result.current.events).toHaveLength(2));
    expect(result.current.events.map((e) => e.course_name)).toEqual(["AI for Business", null]);
  });

  it("yields nothing when the request fails rather than a list of blanks", async () => {
    stubFetch([], false);

    const { result } = renderHook(() => useEventFeed("past", 3));

    await waitFor(() => expect(result.current.events).toEqual([]));
  });

  it("yields nothing when the request rejects outright", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    const { result } = renderHook(() => useEventFeed("past", 3));

    await waitFor(() => expect(result.current.events).toEqual([]));
  });
});
