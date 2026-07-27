"use client";

import { useEffect, useState } from "react";
import type { LandingEvent } from "@/lib/landing";

export function useUpcomingEvents() {
  const [events, setEvents] = useState<LandingEvent[]>([]);

  useEffect(() => {
    fetch("/api/events?filter=upcoming")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setEvents(Array.isArray(data) ? data.slice(0, 2) : []))
      .catch(() => {});
  }, []);

  return { events };
}
