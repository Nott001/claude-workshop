import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  formatEventDate,
  formatTime,
  eventStatusLabel,
  isEventLive,
  isEventFinished,
  parseEventDateTime,
} from "@/shared/lib/date-utils";

describe("date-utils", () => {
  it("formatEventDate produces human-readable dates", () => {
    expect(formatEventDate("2026-05-24")).toContain("May");
    expect(formatEventDate("2026-05-24")).toContain("24");
    expect(formatEventDate("2026-05-24")).toContain("2026");
  });

  it("formatTime converts 24h to 12h", () => {
    expect(formatTime("10:00")).toBe("10:00 AM");
    expect(formatTime("18:30")).toBe("6:30 PM");
    expect(formatTime("00:00")).toBe("12:00 AM");
    expect(formatTime("12:00")).toBe("12:00 PM");
  });

  it("eventStatusLabel maps statuses correctly", () => {
    expect(eventStatusLabel("active")).toBe("Upcoming");
    expect(eventStatusLabel("draft")).toBe("Draft");
    expect(eventStatusLabel("complete")).toBe("Completed");
    expect(eventStatusLabel("unknown")).toBe("unknown");
  });

  describe("isEventLive", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns true when now is within the event window", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "10:30:00")!);
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(true);
    });

    it("returns false when now is before start time", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "09:00:00")!);
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(false);
    });

    it("returns false when now is after end time", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "13:00:00")!);
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(false);
    });

    it("returns true at the exact start time boundary", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "10:00:00")!);
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(true);
    });

    it("returns true at the exact end time boundary", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "12:00:00")!);
      expect(isEventLive("2026-06-15", "10:00", "12:00")).toBe(true);
    });
  });

  describe("isEventFinished", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns true when now is after the end time", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "13:00:00")!);
      expect(isEventFinished("2026-06-15", "12:00")).toBe(true);
    });

    it("returns false when now is before the end time", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "10:00:00")!);
      expect(isEventFinished("2026-06-15", "12:00")).toBe(false);
    });

    it("returns false at the exact end time boundary", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "12:00:00")!);
      expect(isEventFinished("2026-06-15", "12:00")).toBe(false);
    });

    it("returns true for a date already passed", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-16", "00:00:00")!);
      expect(isEventFinished("2026-06-15", "23:59")).toBe(true);
    });

    it("returns false rather than crashing on missing or malformed edges", () => {
      vi.setSystemTime(parseEventDateTime("2026-06-15", "13:00:00")!);
      expect(isEventFinished("", "")).toBe(false);
      expect(isEventFinished(undefined as unknown as string, undefined as unknown as string)).toBe(false);
      expect(isEventFinished("2026-06-15", "")).toBe(false);
      expect(isEventFinished("not-a-date", "12:00")).toBe(false);
    });
  });
});
