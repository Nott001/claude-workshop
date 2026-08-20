import { afterEach, describe, expect, it, vi } from "vitest";
import { featuredEvent } from "@/modules/events/lib/featured-event";
import type { LandingEvent } from "@/shared/types";
import { parseEventDateTime } from "@/shared/lib/date-utils";

const landingEvent = (eventId: number, eventDate: string, startTime: string, endTime: string): LandingEvent => ({
  event_id: eventId,
  title: `Event ${eventId}`,
  event_date: eventDate,
  start_time: startTime,
  end_time: endTime,
  venue_name: "Venue",
  status: "active",
  event_type: "onsite",
  course_name: null,
  cover_image_url: null,
});

// Pinned to 2026-08-12 15:00 so isEventLive and isEventFinished are
// deterministic: anything ending before 15:00 is finished, 14:00–17:00 is live,
// 16:00–18:00 has not started.
const finished = landingEvent(1, "2026-08-12", "09:00", "12:00");
const upcoming = landingEvent(2, "2026-08-12", "16:00", "18:00");
const live = landingEvent(3, "2026-08-12", "14:00", "17:00");
const nextDayUpcoming = landingEvent(4, "2026-08-13", "09:00", "17:00");

describe("featuredEvent", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null for an empty list", () => {
    vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);

    expect(featuredEvent([])).toBeNull();
  });

  it("returns the first (closest) upcoming when nothing is live", () => {
    vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);

    expect(featuredEvent([upcoming, nextDayUpcoming])).toBe(upcoming);
  });

  it("returns a live event even when it is not events[0]", () => {
    vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);

    expect(featuredEvent([upcoming, live])).toBe(live);
  });

  it("never picks a finished event ahead of an upcoming one", () => {
    vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);

    expect(featuredEvent([finished, upcoming])).toBe(upcoming);
  });

  it("returns null when every row has ended", () => {
    vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);

    expect(featuredEvent([finished])).toBeNull();
  });
});
