"use client";

import { useEffect, useState } from "react";
import type { LandingEvent } from "@/shared/types";

export function useSpeakerEvents() {
  const [events, setEvents] = useState<LandingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchEvents() {
      setLoading(true);
      const res = await fetch("/api/speakers/me/events");
      if (!res.ok) {
        if (!cancelled) {
          setError("Failed to load events");
          setLoading(false);
        }
        return;
      }
      const data = await res.json();
      if (!cancelled) {
        setEvents(data);
        setLoading(false);
      }
    }

    fetchEvents();
    return () => {
      cancelled = true;
    };
  }, []);

  return { events, loading, error };
}
