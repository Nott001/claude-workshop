import { describe, it, expect } from "vitest";
import { toLandingEvent, type EventRow } from "@/modules/events/lib/landing-event";

const row: EventRow = {
  id: 41,
  title: "Alpha",
  event_date: "2026-08-12",
  start_time: "09:00:00",
  end_time: "17:00:00",
  venue_name: "Hall A",
  status: "active",
  cover_image_url: null,
  COURSE: { course_name: "AI for Business" },
};

describe("toLandingEvent", () => {
  it("carries the row's `id` across to `event_id`", () => {
    expect(toLandingEvent(row).event_id).toBe(41);
  });

  it("flattens the COURSE embed onto course_name", () => {
    expect(toLandingEvent(row).course_name).toBe("AI for Business");
  });

  it("tolerates a row with no COURSE embed — the landing query selects none", () => {
    const withoutCourse: EventRow = { ...row };
    delete withoutCourse.COURSE;

    expect(toLandingEvent(withoutCourse).course_name).toBeNull();
    expect(toLandingEvent(withoutCourse).event_id).toBe(41);
  });

  it("carries the event's mode, so a card can pick its own venue icon", () => {
    expect(toLandingEvent({ ...row, event_type: "online" }).event_type).toBe("online");
    expect(toLandingEvent({ ...row, event_type: "onsite" }).event_type).toBe("onsite");
  });

  it("defaults a row with no mode to onsite rather than leaving it undefined", () => {
    // Same default the column carries, so a row from before the migration and
    // a payload that simply omitted the field render identically.
    expect(toLandingEvent(row).event_type).toBe("onsite");
    expect(toLandingEvent({ ...row, event_type: null }).event_type).toBe("onsite");
  });

  it("gives every row in a list a distinct, defined key", () => {
    const rows: EventRow[] = [row, { ...row, id: 42, title: "Beta" }];

    const keys = rows.map(toLandingEvent).map((e) => e.event_id);

    expect(keys).toEqual([41, 42]);
    expect(keys.some((k) => k === undefined)).toBe(false);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
