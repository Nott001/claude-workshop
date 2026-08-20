// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, cleanup } from "@testing-library/react";

import { useEventList, type EventListItem } from "@/modules/events/lib/use-event-list";
import { useEventMemories } from "@/modules/events/lib/use-event-memories";
import { useCommunityLinks } from "@/modules/community/lib/use-community-links";

const row = (id: number): EventListItem => ({
  id,
  title: `Event ${id}`,
  event_date: "2026-09-01",
  start_time: "09:00",
  end_time: "12:00",
  venue_name: "Hall",
  venue_address: null,
  status: "active",
  cover_image_url: null,
  COURSE: null,
});

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ data: [], total: 0 }) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("server-seeded lists", () => {
  it("renders the seeded events without asking the API for them again", async () => {
    const { result } = renderHook(() => useEventList({ initial: { rows: [row(1), row(2)], total: 2 } }));

    expect(result.current.events).toHaveLength(2);
    expect(result.current.loading).toBe(false);
    // The point of seeding: the rows are already on screen, so the round trip
    // that used to follow hydration does not happen.
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("survives an effect that runs twice, as it does in development", async () => {
    // A "skip once" flag is spent by the pass React throws away on remount,
    // leaving the real one to refetch what the server already sent — which is
    // what this looked like it was doing until the network was watched.
    const { rerender } = renderHook(() => useEventList({ initial: { rows: [row(1)], total: 1 } }));
    rerender();
    rerender();

    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("still fetches when the reader asks a different question", async () => {
    const { result } = renderHook(() => useEventList({ initial: { rows: [row(1)], total: 1 } }));

    result.current.setActiveTab("completed");

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(String(fetchMock.mock.calls[0][0])).toContain("filter=past");
  });

  it("fetches normally when no seed is handed over", async () => {
    renderHook(() => useEventList());

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  });

  it("seeds the memories strip and the community cards without a request each", async () => {
    const memories = [{ event: { event_id: 7 }, photos: [], photoCount: 0 }] as never;
    const { result: m } = renderHook(() => useEventMemories(3, memories));
    const { result: l } = renderHook(() => useCommunityLinks([{ id: 1, label: "Slack" }] as never));

    expect(m.current.memories).toHaveLength(1);
    expect(l.current.links).toHaveLength(1);
    expect(l.current.loading).toBe(false);
    await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
  });

  it("lets an explicit reload override a seeded card list", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => [{ id: 2, label: "Discord" }] });
    const { result } = renderHook(() => useCommunityLinks([{ id: 1, label: "Slack" }] as never));

    await result.current.reload();

    // The staff page edits a card and calls this; a seed must not pin it.
    await waitFor(() => expect(result.current.links[0].label).toBe("Discord"));
  });
});
