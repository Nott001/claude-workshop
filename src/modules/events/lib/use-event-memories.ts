"use client";

import { useEffect, useRef, useState } from "react";
import type { EventPhoto, LandingEvent } from "@/shared/types";
import { toLandingEvent, type EventRow } from "./landing-event";

/** A finished event as the memories strip renders it. */
export interface EventMemoryCardData {
  event: LandingEvent;
  photos: EventPhoto[];
  photoCount: number;
}

interface MemoryResponse {
  event: EventRow;
  photos?: EventPhoto[];
  photo_count?: number;
}

/**
 * The finished events on /community, each with the head of its photo archive.
 *
 * A separate read from `useEventFeed` rather than a flag on it: this one costs a
 * second query for the photos, and the landing page's upcoming strip — the other
 * caller of that hook — has no archive to show and should not pay for one.
 *
 * A failed read yields an empty list, which hides the whole section. Same
 * contract as the feed it sits beside: a supporting strip on a page with other
 * reasons to exist never trades its silence for a page-wide error.
 */
export function useEventMemories(limit: number, initial?: EventMemoryCardData[]) {
  const [memories, setMemories] = useState<EventMemoryCardData[]>(initial ?? []);
  // Seeded on the server, so the strip is in the first paint rather than
  // arriving a round trip later. Keyed on the limit rather than counted down:
  // development mounts the tree twice, and a one-shot flag is spent by the pass
  // React throws away, leaving the real one to fetch what it was already given.
  const seededLimitRef = useRef(initial ? limit : null);
  const [loading, setLoading] = useState(!initial);

  useEffect(() => {
    if (seededLimitRef.current === limit) return;

    let cancelled = false;

    fetch(`/api/events/memories?limit=${limit}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: { data?: MemoryResponse[] }) => {
        if (cancelled) return;
        const rows = Array.isArray(body.data) ? body.data : [];
        setMemories(
          rows.map((row) => ({
            // Through `toLandingEvent` like every other producer of these cards:
            // the table's key is `id` and the card reads `event_id`, and the one
            // producer that skipped this conversion rendered a grid of links to
            // /events/undefined.
            event: toLandingEvent(row.event),
            photos: row.photos ?? [],
            photoCount: row.photo_count ?? 0,
          })),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { memories, loading };
}
