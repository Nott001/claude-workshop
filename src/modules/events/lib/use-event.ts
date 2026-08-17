"use client";

import { useEffect, useState } from "react";
import type { Event } from "@/shared/types";

/**
 * One event by id.
 *
 * Three pages were each spelling this out inline, and each had picked its own
 * answer to the same questions — whether a failure clears the event or leaves
 * the stale one, whether `loading` ever ends when the fetch never runs. None
 * cancelled on unmount, so a slow answer landed on a page the reader had left.
 *
 * `enabled` exists because every caller is behind a role guard: the fetch must
 * not run for a reader who is being redirected away, and `loading` must stay
 * true until it can, or the page flashes its empty state on the way out.
 */
export function useEvent(eventId: string, { enabled = true }: { enabled?: boolean } = {}) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function load() {
      const res = await fetch(`/api/events/${eventId}`).catch(() => null);

      if (cancelled) return;

      if (!res?.ok) {
        setEvent(null);
        setError("Failed to load event");
        setLoading(false);
        return;
      }

      const data = (await res.json().catch(() => null)) as Event | null;
      if (cancelled) return;

      setEvent(data);
      setError(data ? null : "Failed to load event");
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [eventId, enabled]);

  return { event, loading, error };
}
