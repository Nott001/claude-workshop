// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup, waitFor } from "@testing-library/react";
import { useEvent } from "@/modules/events/lib/use-event";

type FetchFn = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

function stubFetch() {
  const fn = vi.fn<FetchFn>();
  vi.stubGlobal("fetch", fn);
  return fn;
}

const anEvent = { id: 4, title: "Product Summit" };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useEvent", () => {
  it("loads the event by id", async () => {
    const fetch = stubFetch();
    fetch.mockResolvedValue({ ok: true, json: async () => anEvent } as Response);

    const { result } = renderHook(() => useEvent("4"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event).toMatchObject({ id: 4 });
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith("/api/events/4");
  });

  it("reports a refusal instead of leaving a stale event behind", async () => {
    const fetch = stubFetch();
    fetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);

    const { result } = renderHook(() => useEvent("4"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event).toBeNull();
    expect(result.current.error).toBe("Failed to load event");
  });

  it("survives a network failure", async () => {
    const fetch = stubFetch();
    fetch.mockRejectedValue(new Error("offline"));

    const { result } = renderHook(() => useEvent("4"));

    await waitFor(() => expect(result.current.error).toBe("Failed to load event"));
  });

  // Every caller sits behind a role guard: fetching for a reader who is being
  // redirected away is wasted, and ending `loading` would flash an empty page.
  it("does not fetch while disabled, and stays loading", () => {
    const fetch = stubFetch();

    const { result } = renderHook(() => useEvent("4", { enabled: false }));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
  });

  it("fetches once the guard enables it", async () => {
    const fetch = stubFetch();
    fetch.mockResolvedValue({ ok: true, json: async () => anEvent } as Response);

    const { result, rerender } = renderHook(({ enabled }) => useEvent("4", { enabled }), {
      initialProps: { enabled: false },
    });
    expect(fetch).not.toHaveBeenCalled();

    rerender({ enabled: true });

    await waitFor(() => expect(result.current.event).toMatchObject({ id: 4 }));
  });

  it("ignores an answer that arrives after unmount", async () => {
    const fetch = stubFetch();
    let settle: (res: Response) => void = () => {};
    fetch.mockReturnValue(new Promise<Response>((resolve) => (settle = resolve)));

    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => errors.push(args);

    const { unmount } = renderHook(() => useEvent("4"));
    unmount();
    settle({ ok: true, json: async () => anEvent } as Response);
    await Promise.resolve();

    console.error = original;
    expect(errors).toHaveLength(0);
  });
});
