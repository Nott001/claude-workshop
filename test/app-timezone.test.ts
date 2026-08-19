import { describe, it, expect, afterEach, vi } from "vitest";
import { appTimeZone, zonedFields, zonedInstant } from "@/shared/lib/app-timezone";
import { eventZoneDate, eventZoneTime, isEventFinished, isEventStarted, parseEventDateTime } from "@/shared/lib/date-utils";

afterEach(() => {
  vi.useRealTimers();
});

describe("appTimeZone", () => {
  it("names the zone events are run in, not the runtime's", () => {
    // The whole point of the module: a Worker has no local zone and would
    // otherwise answer UTC, hours away from the audience it gates.
    expect(appTimeZone()).toBe("Asia/Manila");
  });
});

describe("zonedInstant", () => {
  it("reads a wall clock in the app zone rather than the runtime's", () => {
    const instant = zonedInstant({ year: 2026, month: 8, day: 18, hour: 17, minute: 0, second: 0 });

    // 17:00 in UTC+8 is 09:00Z. Parsing "2026-08-18T17:00" on a UTC runtime,
    // which is what Workers is, would have produced 17:00Z — eight hours late.
    expect(instant.toISOString()).toBe("2026-08-18T09:00:00.000Z");
  });

  it("survives a daylight-saving shift, where one pass would land an hour out", () => {
    // New York moves to UTC-4 on 2026-03-08 at 02:00; 12:00 that day is 16:00Z.
    const instant = zonedInstant({ year: 2026, month: 3, day: 8, hour: 12, minute: 0, second: 0 }, "America/New_York");

    expect(instant.toISOString()).toBe("2026-03-08T16:00:00.000Z");
  });

  it("round-trips through zonedFields", () => {
    const fields = { year: 2026, month: 12, day: 31, hour: 23, minute: 59, second: 30 };

    expect(zonedFields(zonedInstant(fields))).toEqual(fields);
  });
});

describe("parseEventDateTime", () => {
  it("pads an unpadded time the ISO parser would reject", () => {
    expect(parseEventDateTime("2026-09-01", "9:00")?.toISOString()).toBe("2026-09-01T01:00:00.000Z");
  });

  it("keeps seconds when the source carries them", () => {
    expect(parseEventDateTime("2026-09-01", "09:30:45")?.toISOString()).toBe("2026-09-01T01:30:45.000Z");
  });

  it("returns null rather than an Invalid Date for a bad input", () => {
    expect(parseEventDateTime("", "9:00")).toBeNull();
    expect(parseEventDateTime("2026-09-01", "")).toBeNull();
    expect(parseEventDateTime("2026-09-01", "not-a-time")).toBeNull();
    // Date.UTC would roll month 13 into the next January instead of refusing.
    expect(parseEventDateTime("2026-13-01", "9:00")).toBeNull();
    expect(parseEventDateTime("2026-09-01", "25:00")).toBeNull();
  });
});

describe("the gates that read the clock", () => {
  it("holds an event closed until its start arrives in the app zone", () => {
    // 08:59 in Manila, an hour before a 10:00 start.
    vi.setSystemTime(new Date("2026-08-18T00:59:00Z"));
    expect(isEventStarted("2026-08-18", "10:00")).toBe(false);

    vi.setSystemTime(new Date("2026-08-18T02:00:00Z"));
    expect(isEventStarted("2026-08-18", "10:00")).toBe(true);
  });

  it("finishes an event at its own closing minute, not eight hours later", () => {
    // 16:59 Manila: not finished. This is the case a UTC runtime got wrong,
    // and it is what releases a bundle, so the unlock rides on it.
    vi.setSystemTime(new Date("2026-08-18T08:59:00Z"));
    expect(isEventFinished("2026-08-18", "17:00")).toBe(false);

    vi.setSystemTime(new Date("2026-08-18T09:01:00Z"));
    expect(isEventFinished("2026-08-18", "17:00")).toBe(true);
  });

  it("refuses to place an event whose window is incomplete", () => {
    expect(isEventStarted("2026-08-18", null)).toBe(false);
    expect(isEventFinished("", "17:00")).toBe(false);
  });

  it("reports today and now on the app zone's calendar", () => {
    // 16:30Z on the 18th is already 00:30 on the 19th in Manila — the day
    // boundary a UTC date string would put on the wrong side.
    vi.setSystemTime(new Date("2026-08-18T16:30:00Z"));

    expect(eventZoneDate()).toBe("2026-08-19");
    expect(eventZoneTime()).toBe("00:30:00");
  });
});
