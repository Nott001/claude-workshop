"use client";

import { useEventFeed } from "./use-event-feed";

/** The next two sessions, for the landing page's upcoming strip. */
export function useUpcomingEvents() {
  return useEventFeed("upcoming", 2);
}
