"use client";

import { useEffect, useState } from "react";
import type { LandingEvent } from "@/shared/types";
import { toLandingEvent, type EventRow } from "./landing-event";

export function useUpcomingEvents() {
  const [events, setEvents] = useState<LandingEvent[]>([]);

  useEffect(() => {
    fetch("/api/events?filter=upcoming")
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((data: unknown) => {
        const rows = (data as { data?: unknown }).data;
        setEvents(Array.isArray(rows) ? (rows as EventRow[]).slice(0, 2).map(toLandingEvent) : []);
      })
      .catch(() => {});
  }, []);

  return { events };
}
