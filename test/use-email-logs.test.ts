// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { useEmailLogs } from "@/shared/integrations/email/use-email-logs";

const emailRows = [
  {
    id: 21,
    email_type: "ticket_issued",
    status: "sent",
    sent_at: "2026-08-01",
    USER: { full_name: "Ada", email: "a@e.com" },
  },
];

function stubFetch() {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(String(url));
      return { ok: true, json: async () => ({ data: emailRows, total: 1, page: 1, limit: 50 }) };
    }),
  );
  return urls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useEmailLogs debounced search", () => {
  it("starts with no search term on the first request", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    renderHook(() => useEmailLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(urls[urls.length - 1]).toBe("/api/logs?page=1&limit=50");
  });

  it("does not refetch while typing, then refetches after the debounce window", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useEmailLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls).toHaveLength(1);

    act(() => result.current.setSearch("Ada"));

    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/logs?page=1&limit=50&search=Ada");
  });

  it("resets to the first page when the search changes", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useEmailLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    await act(async () => {
      await result.current.loadMore();
    });
    expect(urls[urls.length - 1]).toBe("/api/logs?page=2&limit=50");

    act(() => result.current.setSearch("Ada"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(urls[urls.length - 1]).toBe("/api/logs?page=1&limit=50&search=Ada");
  });

  it("omits the search param after clearing the term", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useEmailLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => result.current.setSearch("Ada"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    act(() => result.current.setSearch(""));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/logs?page=1&limit=50");
  });

  it("marks the list as ended when a single page is returned", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: emailRows, total: 1, page: 1, limit: 50 }) })),
    );

    const { result } = renderHook(() => useEmailLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.logs).toHaveLength(1);
    expect(result.current.hasMore).toBe(false);
  });

  it("treats a non-array payload as no rows", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ data: null, total: 0, page: 1, limit: 50 }) })),
    );

    const { result } = renderHook(() => useEmailLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(result.current.logs).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it("sets error and keeps the loaded rows when a refetch fails, clearing on success", async () => {
    vi.useFakeTimers();
    let fail = false;
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(String(url));
        if (fail) return { ok: false };
        return { ok: true, json: async () => ({ data: emailRows, total: 1, page: 1, limit: 50 }) };
      }),
    );

    const { result } = renderHook(() => useEmailLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.error).toBeNull();

    fail = true;
    act(() => result.current.setSearch("zzz"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    // The rows that were on screen survive the failed refetch, with the error
    // exposed for the page's notice.
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.error).toBe("Failed to load email logs");

    fail = false;
    act(() => result.current.setSearch("ada"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.error).toBeNull();
  });
});
