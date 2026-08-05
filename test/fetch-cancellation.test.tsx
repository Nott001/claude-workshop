// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StrictMode } from "react";
import { renderHook, cleanup, waitFor, act } from "@testing-library/react";
import { useEventList } from "@/modules/events/lib/use-event-list";
import { useCourseByEvent } from "@/modules/courses/lib/use-course-by-event";

vi.mock("@/modules/auth/components/session-context", () => ({
  useSession: () => ({ user: null, loading: false, isLoaded: true, isSignedIn: false }),
}));

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

/** A fetch whose responses are resolved by the test, one call at a time. */
function deferredFetch() {
  const pending: { resolve: (value: unknown) => void }[] = [];
  const fetchMock = vi.fn(
    () =>
      new Promise((resolve) => {
        pending.push({ resolve: (value) => resolve({ ok: true, json: async () => value }) });
      }),
  );
  return { fetchMock, pending };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useEventList under strict mode's mount/unmount/remount", () => {
  it("does not flash the empty state when the discarded first run resolves", async () => {
    const { fetchMock, pending } = deferredFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useEventList(), { wrapper: StrictMode });

    // Strict mode ran the effect twice; the first run's cleanup already fired.
    await waitFor(() => expect(pending.length).toBe(2));

    // The discarded run answers first. Before the fix its unguarded
    // setLoading(false) landed with `events` still empty, and the page rendered
    // "No events found" until the live run came back.
    await act(async () => {
      pending[0].resolve(events);
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.filteredEvents).toEqual([]);

    await act(async () => {
      pending[1].resolve(events);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.filteredEvents).toHaveLength(1);
  });

  it("ends with the live run's data, never the discarded one's", async () => {
    const { fetchMock, pending } = deferredFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useEventList(), { wrapper: StrictMode });
    await waitFor(() => expect(pending.length).toBe(2));

    await act(async () => {
      pending[1].resolve(events);
      pending[0].resolve([]);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.filteredEvents).toHaveLength(1);
  });
});

describe("useCourseByEvent when the event changes mid-flight", () => {
  it("keeps loading until the run for the current event answers", async () => {
    const { fetchMock, pending } = deferredFetch();
    vi.stubGlobal("fetch", fetchMock);

    const { result, rerender } = renderHook(({ id }) => useCourseByEvent(id), { initialProps: { id: "1" } });
    await waitFor(() => expect(pending.length).toBe(1));

    rerender({ id: "2" });
    await waitFor(() => expect(pending.length).toBe(2));

    // Event 1's response is now stale. Letting it clear `loading` would show the
    // "no course" state for an event whose request is still in flight.
    await act(async () => {
      pending[0].resolve({ id: 99, course_name: "Stale", MODULE: [] });
    });

    expect(result.current.loading).toBe(true);
    expect(result.current.course).toBeNull();

    await act(async () => {
      pending[1].resolve({ id: 7, course_name: "Live", MODULE: [] });
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.course?.course_name).toBe("Live");
  });
});

// A rejected request used to escape as an unhandled rejection, leaving
// `loading` set with nothing to clear it and the page on its skeleton forever.
describe("useEventList recovers from a failed request", () => {
  it("clears loading and reports an error when the fetch rejects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("Failed to fetch"))),
    );

    const { result } = renderHook(() => useEventList());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load events");
  });

  it("clears loading when the response body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      })),
    );

    const { result } = renderHook(() => useEventList());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load events");
  });

  it("clears loading on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );

    const { result } = renderHook(() => useEventList());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load events");
  });
});
