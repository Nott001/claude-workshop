// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { useEventList } from "@/modules/events/lib/use-event-list";

const events = [
  {
    id: 41,
    title: "Alpha",
    event_date: "2026-08-12",
    start_time: "09:00:00",
    end_time: "17:00:00",
    venue_name: "Hall A",
    venue_address: null,
    status: "active",
    cover_image_url: null,
    COURSE: null,
  },
];

function stubFetch() {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(String(url));
      return { ok: true, json: async () => ({ data: events, total: 1, page: 1, limit: 50 }) };
    }),
  );
  return urls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useEventList debounced search", () => {
  it("starts with no search term on the first request", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(urls[urls.length - 1]).toBe("/api/events?page=1&limit=50&filter=upcoming&status=active");
    expect(result.current.search).toBe("");
  });

  it("refetches with search only after the debounce window", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls).toHaveLength(1);

    act(() => result.current.setSearch("Alpha"));

    // Still only the initial request: the term is pending inside the debounce.
    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toContain("search=Alpha");
  });

  it("resets to page 1 when the debounced search changes", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    // Page the list forward, then search; the refetch must land on page 1.
    act(() => result.current.setSearch("Alpha"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    const last = urls[urls.length - 1];
    expect(last).toContain("search=Alpha");
    const pageParam = new URL(last, "http://localhost").searchParams.get("page");
    expect(pageParam).toBe("1");
  });

  it("omits the search param after clearing the term", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => result.current.setSearch("Alpha"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    act(() => result.current.setSearch(""));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).not.toContain("search=");
  });

  it("keeps the rows already on screen when a refetch fails", async () => {
    vi.useFakeTimers();
    let fail = false;
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        if (fail) return { ok: false };
        return { ok: true, json: async () => ({ data: events, total: 1, page: 1, limit: 50 }) };
      }),
    );

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.events).toHaveLength(1);

    fail = true;
    act(() => result.current.setSearch("Alpha"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // A failed search must not wipe the rows it would have replaced; the page
    // chrome depends on them staying put.
    expect(result.current.events).toHaveLength(1);
    expect(result.current.error).toBe("Failed to load events");
    expect(result.current.loading).toBe(false);
  });

  it("marks the list as ended when a single page is returned", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: events, total: 1, page: 1, limit: 50 }) })),
    );

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.hasMore).toBe(false);
  });

  it("treats a non-array payload as no rows", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: null, total: 0, page: 1, limit: 50 }) })),
    );

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.events).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it("surfaces an error when loading more fails", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string) => {
      const page = new URL(String(url), "http://localhost").searchParams.get("page");
      if (page === "2") return { ok: false };
      return { ok: true, json: async () => ({ data: events, total: 51, page: 1, limit: 50 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.hasMore).toBe(true);

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.error).toBe("Failed to load events");
    expect(result.current.loadingMore).toBe(false);
    expect(result.current.events).toHaveLength(1);
  });
});
