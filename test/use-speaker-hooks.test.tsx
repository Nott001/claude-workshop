// @vitest-environment jsdom
import { StrictMode, type ReactNode } from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";
import { useSpeakerEvents } from "@/modules/events/lib/use-speaker-events";
import { useSpeakerEvent } from "@/modules/events/lib/use-speaker-event";

function deferred() {
  let resolve!: (value: Response) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

afterEach(() => {
  cleanup();
  // unstubAllGlobals alone leaves spyOn-created fetch spies alive between
  // tests, so exact call-count assertions would see earlier tests' calls.
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("useSpeakerEvents", () => {
  const upcomingRows = [{ event_id: 1, title: "Upcoming Talk" }];
  const completedRows = [{ event_id: 2, title: "Past Talk" }];
  const draftsRows = [{ event_id: 3, title: "Draft Talk" }];

  function mockBuckets(failFilter?: string) {
    return vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
      const url = String(input);
      const filter = url.split("filter=")[1];
      if (filter === failFilter) {
        return Promise.resolve({ ok: false, json: async () => [] } as unknown as Response);
      }
      const body = filter === "completed" ? completedRows : filter === "drafts" ? draftsRows : upcomingRows;
      return Promise.resolve({ ok: true, json: async () => body } as unknown as Response);
    });
  }

  it("loads the upcoming bucket on mount and exposes it via events and upcoming", async () => {
    const fetchMock = mockBuckets();

    const { result } = renderHook(() => useSpeakerEvents());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/speakers/me/events?filter=upcoming");
    expect(result.current.events).toEqual(upcomingRows);
    expect(result.current.upcoming.events).toEqual(upcomingRows);
  });

  it("fetches completed on first visit and lands its rows in events", async () => {
    const fetchMock = mockBuckets();

    const { result } = renderHook(() => useSpeakerEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setActiveTab("completed"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/speakers/me/events?filter=completed");
    expect(result.current.events).toEqual(completedRows);
    expect(result.current.upcoming.events).toEqual(upcomingRows);
  });

  it("issues no second fetch when returning to an already-loaded tab", async () => {
    const fetchMock = mockBuckets();

    const { result } = renderHook(() => useSpeakerEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setActiveTab("completed"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setActiveTab("upcoming"));
    await waitFor(() => expect(result.current.upcoming.loading).toBe(false));

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "/api/speakers/me/events?filter=upcoming",
      "/api/speakers/me/events?filter=completed",
    ]);
    expect(result.current.events).toEqual(upcomingRows);
  });

  it("settles after a StrictMode double-mount instead of staying loading", async () => {
    const fetchMock = mockBuckets();
    // Dev runs effects twice: mount, cleanup, mount again. The cache guard used
    // to let the second run skip the fetch while the first run's cancellation
    // flag discarded the result — the tab then stayed loading forever.
    const wrapper = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

    const { result } = renderHook(() => useSpeakerEvents(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledWith("/api/speakers/me/events?filter=upcoming");
    expect(result.current.events).toEqual(upcomingRows);
    expect(result.current.upcoming.loading).toBe(false);
  });

  it("sets error on a failed fetch and keeps the previously loaded rows", async () => {
    const fetchMock = mockBuckets("completed");

    const { result } = renderHook(() => useSpeakerEvents());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setActiveTab("completed"));
    await waitFor(() => expect(result.current.error).toBe("Failed to load events"));

    expect(result.current.loading).toBe(false);
    expect(result.current.upcoming.events).toEqual(upcomingRows);

    act(() => result.current.setActiveTab("upcoming"));
    expect(result.current.events).toEqual(upcomingRows);
    expect(fetchMock.mock.calls.length).toBe(2);
  });

  it("does not write state after an unmount", async () => {
    const { promise, resolve } = deferred();
    vi.spyOn(globalThis, "fetch").mockReturnValue(promise);

    const { result, unmount } = renderHook(() => useSpeakerEvents());
    unmount();
    resolve({
      ok: true,
      json: async () => [],
    } as unknown as Response);

    // The superseded run must leave every flag to the unmounted hook's owner.
    await act(async () => {
      await promise;
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.events).toEqual([]);
  });
});

describe("useSpeakerEvent", () => {
  it("surfaces the fallback error when a 500 body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("not json")),
    } as unknown as Response);

    const { result } = renderHook(() => useSpeakerEvent("7"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load event details");
    expect(result.current.event).toBeNull();
  });

  it("keeps loading true for a request answered after unmount", async () => {
    const { promise, resolve } = deferred();
    vi.spyOn(globalThis, "fetch").mockReturnValue(promise);

    const { result, unmount } = renderHook(() => useSpeakerEvent("7"));
    unmount();
    resolve({
      ok: true,
      json: async () => ({ event_id: 7 }),
    } as unknown as Response);

    await act(async () => {
      await promise;
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.event).toBeNull();
  });

  it("loads the speaker's event", async () => {
    const event = {
      event_id: 7,
      title: "Demo Day",
      event_date: "2026-09-01",
      start_time: "09:00",
      end_time: "17:00",
      status: "active",
    };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => event,
    } as unknown as Response);

    const { result } = renderHook(() => useSpeakerEvent("7"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.event).toMatchObject({ event_id: 7 });
  });
});
