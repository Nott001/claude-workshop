import { describe, it, expect, vi } from "vitest";

import * as photoDao from "@/modules/events/db/event-photo.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * A PostgREST builder stub. Every terminal read on this table resolves through
 * `then`, so the chain records what was asked for and hands back the rows the
 * test supplied.
 */
function stubClient(rows: unknown[], captured: Record<string, unknown> = {}) {
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit"]) {
    builder[method] = vi.fn((...args: unknown[]) => {
      // Accumulated: `order` is called twice on a gallery read, and keeping only
      // the last one would hide the primary sort.
      captured[method] = [...((captured[method] as unknown[][]) ?? []), args];
      return builder;
    });
  }
  builder.maybeSingle = vi.fn(async () => ({ data: rows[0] ?? null, error: null }));
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) => resolve({ data: rows, error: null });
  const from = vi.fn((table: string) => {
    captured.from = [table];
    return builder;
  });
  // `as never` on the whole client would hide `from` from the assertions below;
  // the cast is on the argument the DAO takes, not on the handle held here.
  return { captured, from, client: { from } as unknown as DbClient };
}

const row = (id: number, eventId: number, order = 0) => ({
  id,
  event_id: eventId,
  storage_path: `events/${eventId}/photos/${id}.jpg`,
  caption: null,
  sequence_order: order,
  created_at: "2026-05-01T00:00:00Z",
});

describe("event-photo.dao", () => {
  it("serves an object key as a URL the browser can fetch", async () => {
    const { client } = stubClient([row(3, 7)]);

    const [photo] = await photoDao.listByEvent(client, 7);

    // The bucket is addressed by key; the page renders an href. Every consumer
    // gets the second without having to know the first.
    expect(photo.image_url).toBe("/api/storage/event_images/events/7/photos/3.jpg");
    expect(photo).not.toHaveProperty("storage_path");
  });

  it("groups previews by event and caps each at the requested count", async () => {
    const { client } = stubClient([row(1, 7), row(2, 7), row(3, 7), row(4, 8)]);

    const previews = await photoDao.listPreviewsByEvents(client, [7, 8], 2);

    expect(previews.get(7)?.photos.map((p) => p.id)).toEqual([1, 2]);
    expect(previews.get(8)?.photos.map((p) => p.id)).toEqual([4]);
  });

  it("reports the whole archive's size, not the number of thumbnails kept", async () => {
    const { client } = stubClient([row(1, 7), row(2, 7), row(3, 7)]);

    const previews = await photoDao.listPreviewsByEvents(client, [7], 1);

    // The card offers "View 3 photos" off this number; slicing before counting
    // would make it offer to show one.
    expect(previews.get(7)?.total).toBe(3);
    expect(previews.get(7)?.photos).toHaveLength(1);
  });

  it("never queries for an empty id list, which PostgREST reads as no filter", async () => {
    const { client, from } = stubClient([row(1, 7)]);

    const previews = await photoDao.listPreviewsByEvents(client, [], 4);

    expect(previews.size).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });

  it("appends the next photo after everything already in the sequence", async () => {
    const { client } = stubClient([{ sequence_order: 4 }]);

    await expect(photoDao.nextSequenceOrder(client, 7)).resolves.toBe(5);
  });

  it("starts an empty event's sequence at zero", async () => {
    const { client } = stubClient([]);

    await expect(photoDao.nextSequenceOrder(client, 7)).resolves.toBe(0);
  });

  it("orders a gallery by its sequence, not by insertion id alone", async () => {
    const { client, captured } = stubClient([]);

    await photoDao.listByEvent(client, 7);

    // Sequence first, id only as the tie-break: ordering by id alone would put
    // whatever was uploaded last wherever its id happened to fall.
    expect(captured.order).toEqual([
      ["sequence_order", { ascending: true }],
      ["id", { ascending: true }],
    ]);
    expect(captured.from).toEqual(["EVENT_PHOTO"]);
  });
});
