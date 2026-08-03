"use client";

import { useEffect, useState } from "react";
import type { LandingEvent } from "@/shared/types";
import { toLandingEvent, type EventRow } from "./landing-event";

export function useUpcomingEvents() {
  const [events, setEvents] = useState<LandingEvent[]>([]);

  useEffect(() => {
    fetch("/api/events?filter=upcoming")
      .then((res) => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        setEvents(Array.isArray(data) ? (data as EventRow[]).slice(0, 2).map(toLandingEvent) : []);
      })
      .catch(() => {});
  }, []);

  return { events };
}
