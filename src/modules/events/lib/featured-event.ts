import { isEventFinished, isEventLive } from "@/shared/lib/date-utils";
import type { LandingEvent } from "@/shared/types";

/**
 * The headline engagement: the assigned event that is live right now — an
 * event that has started is closer than one still waiting — else the closest
 * upcoming. Rows arrive date-sorted from findByIds, so the first not-yet-
 * finished event is the nearest not-yet-started session. Rows whose end edge
 * has passed are excluded outright: the upcoming bucket would not contain them
 * in real data, but the selector must not surface one if it ever does.
 */
export function featuredEvent(events: LandingEvent[]): LandingEvent | null {
  const candidates = events.filter((event) => !isEventFinished(event.event_date, event.end_time));
  const live = candidates.find((event) => isEventLive(event.event_date, event.start_time, event.end_time));
  return live ?? candidates[0] ?? null;
}
