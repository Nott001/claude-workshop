import { describe, it, expect, vi, beforeEach } from "vitest";

const { eventList, listPreviewsByEvents } = vi.hoisted(() => ({
  eventList: vi.fn(),
  listPreviewsByEvents: vi.fn(),
}));

vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/modules/events/db/event.dao", () => ({ list: eventList, isPublished: vi.fn(), findById: vi.fn() }));
vi.mock("@/modules/events/db/event-photo.dao", () => ({ listPreviewsByEvents }));

import { GET } from "@/app/api/events/memories/route";

const finished = (id: number) => ({ id, title: `Event ${id}`, event_date: "2026-05-01", status: "complete" });
const photo = (id: number, eventId: number) => ({
  id,
  event_id: eventId,
  image_url: `/api/storage/event_images/events/${eventId}/photos/${id}.jpg`,
  caption: null,
  sequence_order: 0,
  created_at: "2026-05-01T00:00:00Z",
});

const get = (query = "") => GET(new Request(`https://app.test/api/events/memories${query}`));

beforeEach(() => {
  vi.clearAllMocks();
  eventList.mockResolvedValue({ data: [finished(1), finished(2)], total: 2, page: 1, limit: 3 });
  listPreviewsByEvents.mockResolvedValue(new Map([[1, { photos: [photo(8, 1)], total: 5 }]]));
});

describe("GET /api/events/memories", () => {
  it("asks only for finished events, and never scopes them to a caller", async () => {
    await get();

    // The page renders to visitors with no session, so a role or a user id here
    // would serve a different archive depending on who happened to be reading.
    expect(eventList).toHaveBeenCalledWith({}, expect.objectContaining({ filter: "past", role: null, userId: null }));
  });

  it("resolves the whole strip in one photo query rather than one per card", async () => {
    await get();

    expect(listPreviewsByEvents).toHaveBeenCalledTimes(1);
    expect(listPreviewsByEvents).toHaveBeenCalledWith({}, [1, 2], expect.any(Number));
  });

  it("carries the archive's real size, so a card can offer the whole set", async () => {
    const body = await (await get()).json();

    expect(body.data[0].photo_count).toBe(5);
    expect(body.data[0].photos).toHaveLength(1);
  });

  it("keeps an unphotographed event on the strip", async () => {
    const body = await (await get()).json();

    // Dropping it would silently shrink the archive the moment a session went
    // unphotographed; the card degrades to the summary it has always been.
    expect(body.data).toHaveLength(2);
    expect(body.data[1]).toMatchObject({ photos: [], photo_count: 0 });
  });

  it("never asks for photos when there are no finished events", async () => {
    eventList.mockResolvedValue({ data: [], total: 0, page: 1, limit: 3 });

    const body = await (await get()).json();

    expect(body.data).toEqual([]);
    expect(listPreviewsByEvents).not.toHaveBeenCalled();
  });

  it("caps a caller-supplied limit at the strip's one row", async () => {
    await get("?limit=500");

    expect(eventList).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 3 }));
  });

  it("falls back to the default for a limit that is not a number", async () => {
    await get("?limit=abc");

    expect(eventList).toHaveBeenCalledWith({}, expect.objectContaining({ limit: 3 }));
  });
});
