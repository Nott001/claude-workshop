// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup, act } from "@testing-library/react";
import { useAuditLogs } from "@/modules/audit/lib/use-audit-logs";

const logs = [
  {
    id: 11,
    action: "event.created",
    entity_type: "event",
    entity_id: 1,
    metadata: null,
    created_at: "2026-08-01",
    ACTOR: null,
  },
];

function stubFetch() {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      urls.push(String(url));
      return { ok: true, json: async () => ({ logs, total: 1 }) };
    }),
  );
  return urls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useAuditLogs debounced search", () => {
  it("keeps the last rows and exposes an error when a refetch fails", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("search=")) return { ok: false, json: async () => ({}) };
      return { ok: true, json: async () => ({ logs, total: 1 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuditLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.logs).toHaveLength(1);
    expect(result.current.error).toBeNull();

    act(() => result.current.setSearch("event"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.error).toBe("Failed to refresh audit logs — showing last loaded results.");
    expect(result.current.logs).toHaveLength(1);
  });

  it("surfaces the notice when a refetch request throws", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("search=")) throw new Error("network down");
      return { ok: true, json: async () => ({ logs, total: 1 }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAuditLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.logs).toHaveLength(1);

    act(() => result.current.setSearch("event"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(result.current.error).toBe("Failed to refresh audit logs — showing last loaded results.");
    expect(result.current.logs).toHaveLength(1);
  });

  it("starts with no search term on the first request", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    renderHook(() => useAuditLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(urls[urls.length - 1]).toBe("/api/audit-logs?page=1");
  });

  it("does not refetch while typing, then refetches after the debounce window", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useAuditLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls).toHaveLength(1);

    act(() => result.current.setSearch("event"));

    expect(urls).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/audit-logs?page=1&search=event");
  });

  it("resets to page 1 when the search changes", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useAuditLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => result.current.setPage(3));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(urls[urls.length - 1]).toBe("/api/audit-logs?page=3");
    expect(result.current.page).toBe(3);

    act(() => result.current.setSearch("event"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.page).toBe(1);
    expect(urls[urls.length - 1]).toBe("/api/audit-logs?page=1&search=event");
  });

  it("omits the search param after clearing the term", async () => {
    vi.useFakeTimers();
    const urls = stubFetch();

    const { result } = renderHook(() => useAuditLogs());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    act(() => result.current.setSearch("event"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    act(() => result.current.setSearch(""));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(urls[urls.length - 1]).toBe("/api/audit-logs?page=1");
  });
});
