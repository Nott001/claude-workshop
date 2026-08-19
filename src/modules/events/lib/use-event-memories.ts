"use client";

import { useEffect, useState } from "react";
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
export function useEventMemories(limit: number) {
  const [memories, setMemories] = useState<EventMemoryCardData[]>([]);

  useEffect(() => {
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
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [limit]);

  return { memories };
}
