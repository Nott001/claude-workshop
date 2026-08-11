import { describe, it, expect } from "vitest";
import {
  buildGoogleCalendarUrl,
  buildOutlookCalendarUrl,
  buildIcsHref,
  type CalendarEventData,
} from "@/shared/lib/calendar-links";

const base: CalendarEventData = {
  title: "AI Workshop",
  date: "2024-01-15",
  startTime: "9:00",
  endTime: "17:00",
};

const decodeIcs = (href: string): string => decodeURIComponent(href.split(",").slice(1).join(","));

describe("buildGoogleCalendarUrl", () => {
  it("builds the TEMPLATE url with zero-padded local times and no zone", () => {
    expect(buildGoogleCalendarUrl(base)).toBe(
      "https://calendar.google.com/calendar/render?action=TEMPLATE&text=AI%20Workshop&dates=20240115T090000%2F20240115T170000",
    );
  });

  it("omits details and location when they are empty", () => {
    expect(buildGoogleCalendarUrl(base)).not.toContain("details=");
    expect(buildGoogleCalendarUrl(base)).not.toContain("location=");
  });

  it("adds details and location when present", () => {
    const url = buildGoogleCalendarUrl({
      ...base,
      description: "Intro to agents",
      location: "Hall A, 123 Main St",
    });
    expect(url).toContain("details=Intro%20to%20agents");
    expect(url).toContain("location=Hall%20A%2C%20123%20Main%20St");
  });
});

describe("buildOutlookCalendarUrl", () => {
  it("builds the compose url with zero-padded local times", () => {
    expect(buildOutlookCalendarUrl(base)).toBe(
      "https://outlook.live.com/calendar/0/action/compose?allday=false&subject=AI%20Workshop&startdt=2024-01-15T09%3A00%3A00&enddt=2024-01-15T17%3A00%3A00",
    );
  });

  it("omits body and location when they are empty", () => {
    expect(buildOutlookCalendarUrl(base)).not.toContain("body=");
    expect(buildOutlookCalendarUrl(base)).not.toContain("location=");
  });
});

describe("buildIcsHref", () => {
  it("is a data:text/calendar URI carrying DTSTART, DTEND and SUMMARY", () => {
    const href = buildIcsHref(base);
    expect(href.startsWith("data:text/calendar;charset=utf-8,")).toBe(true);
    const ics = decodeIcs(href);
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("DTSTART:20240115T090000");
    expect(ics).toContain("DTEND:20240115T170000");
    expect(ics).toContain("SUMMARY:AI Workshop");
  });

  it("derives a stable UID and DTSTAMP from the event fields", () => {
    const ics = decodeIcs(buildIcsHref(base));
    expect(ics).toContain("UID:event-20240115T090000@claude-workshop");
    expect(ics).toContain("DTSTAMP:20240115T000000Z");
    expect(buildIcsHref(base)).toBe(buildIcsHref(base));
  });

  it("omits DESCRIPTION and LOCATION lines when empty", () => {
    const ics = decodeIcs(buildIcsHref(base));
    expect(ics).not.toContain("DESCRIPTION:");
    expect(ics).not.toContain("LOCATION:");
  });

  it("escapes ICS content separators in description and location", () => {
    const ics = decodeIcs(buildIcsHref({ ...base, description: "Sessions, Q&A", location: "Hall A, 123 Main St" }));
    expect(ics).toContain("DESCRIPTION:Sessions\\, Q&A");
    expect(ics).toContain("LOCATION:Hall A\\, 123 Main St");
  });
});
