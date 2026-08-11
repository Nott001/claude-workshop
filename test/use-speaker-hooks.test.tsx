// @vitest-environment jsdom
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
  vi.unstubAllGlobals();
});

describe("useSpeakerEvents", () => {
  it("loads the speaker's events", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [{ event_id: 1, title: "Demo Day" }],
    } as unknown as Response);

    const { result } = renderHook(() => useSpeakerEvents());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([{ event_id: 1, title: "Demo Day" }]);
    expect(fetchMock).toHaveBeenCalledWith("/api/speakers/me/events");
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
