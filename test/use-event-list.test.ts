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

/** A fetch that holds one URL substring open until the test releases it. */
function gatedFetch(gateOn: string) {
  let release: (() => void) | null = null;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetchMock = vi.fn(async (url: string) => {
    const params = new URL(String(url), "http://localhost").searchParams;
    const page = params.get("page");
    if (String(url).includes(gateOn)) await gate;
    return {
      ok: true,
      json: async () => ({
        data: [{ ...events[0], id: Number(page) * 100, title: `page ${page} of ${params.get("search") ?? "all"}` }],
        total: 500,
        page: Number(page),
        limit: 50,
      }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return { release: () => release!(), fetchMock };
}

describe("useEventList pagination against a changing query", () => {
  // A page two in flight when a search landed used to append the old tab's rows
  // underneath the new tab's, and left hasMore and total describing a listing
  // nobody was looking at.
  it("drops a page that arrives after the query it belonged to was replaced", async () => {
    vi.useFakeTimers();
    const { release } = gatedFetch("page=2");

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    let paging: Promise<void>;
    act(() => {
      paging = result.current.loadMore();
    });

    act(() => {
      result.current.setSearch("Alpha");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(result.current.events.map((e) => e.title)).toEqual(["page 1 of Alpha"]);

    await act(async () => {
      release();
      await paging!;
      await vi.advanceTimersByTimeAsync(0);
    });

    // The stale page is discarded rather than appended under the search hits.
    expect(result.current.events.map((e) => e.title)).toEqual(["page 1 of Alpha"]);
    expect(result.current.loadingMore).toBe(false);

    vi.useRealTimers();
  });

  // Advanced before the request and never rolled back, a failed page two left
  // the cursor on two, so the retry asked for three and page two's rows were
  // unreachable without reloading the page.
  it("retries the page that failed rather than the one after it", async () => {
    vi.useFakeTimers();
    const urls: string[] = [];
    let failNext = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        const page = new URL(String(url), "http://localhost").searchParams.get("page");
        if (page === "2" && failNext) {
          failNext = false;
          return { ok: false };
        }
        return { ok: true, json: async () => ({ data: events, total: 500, page: Number(page), limit: 50 }) };
      }),
    );

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.error).toBe("Failed to load events");

    await act(async () => {
      await result.current.loadMore();
    });

    const pages = urls.map((u) => new URL(u, "http://localhost").searchParams.get("page"));
    expect(pages).toEqual(["1", "2", "2"]);

    vi.useRealTimers();
  });

  it("ignores a second load while the first page is still in flight", async () => {
    vi.useFakeTimers();
    const { release, fetchMock } = gatedFetch("page=2");

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    let first: Promise<void>;
    act(() => {
      first = result.current.loadMore();
      result.current.loadMore();
    });

    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes("page=2"))).toHaveLength(1);

    await act(async () => {
      release();
      await first!;
    });

    vi.useRealTimers();
  });
});

describe("useEventList tab switching", () => {
  // The rows a tab is replacing stay up and the refetch reports itself through
  // `refreshing`, exactly as a search does — never through the skeleton, which
  // is the cold start alone. The page-level guard against the empty-state flash
  // this used to cause lives in events-page.test.tsx.
  it("keeps the previous tab's rows on screen until the new tab answers", async () => {
    vi.useFakeTimers();
    const { release } = gatedFetch("filter=past");

    const { result } = renderHook(() => useEventList());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.events).toHaveLength(1);

    act(() => {
      result.current.setActiveTab("completed");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.events).toHaveLength(1);
    expect(result.current.refreshing).toBe(true);
    expect(result.current.loading).toBe(false);

    await act(async () => {
      release();
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.refreshing).toBe(false);
    expect(result.current.events).toHaveLength(1);

    vi.useRealTimers();
  });
});
