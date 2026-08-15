"use client";

import { useEffect, useState } from "react";
import type { LandingEvent } from "@/shared/types";
import { toLandingEvent, type EventRow } from "./landing-event";

/** The filters `/api/events` understands as a window on the calendar. */
export type EventFeedFilter = "upcoming" | "past";

/**
 * The read behind every "a handful of events, as cards" strip: the landing
 * page's next sessions and the community page's finished ones differ only in
 * which end of the calendar they ask for and how many they show.
 *
 * `limit` is sent to the API rather than applied to the response, so the wire
 * carries the rows the strip actually renders instead of a page of fifty.
 *
 * A failed read yields an empty list. Every caller is a supporting strip on a
 * page that has other reasons to exist, so none of them wants to trade its own
 * silence for an error message over the whole page.
 */
export function useEventFeed(filter: EventFeedFilter, limit: number) {
  const [events, setEvents] = useState<LandingEvent[]>([]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/events?filter=${filter}&limit=${limit}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((body: unknown) => {
        if (cancelled) return;
        const rows = (body as { data?: unknown }).data;
        setEvents(Array.isArray(rows) ? (rows as EventRow[]).map(toLandingEvent) : []);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [filter, limit]);

  return { events };
}
