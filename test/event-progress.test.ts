import { describe, it, expect } from "vitest";
import { eventProgress } from "@/shared/lib/event-progress";

const EVENT_DATE = "2026-09-01";

function at(hour: number, minute: number): Date {
  return new Date(`${EVENT_DATE}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`);
}

describe("eventProgress", () => {
  it("returns 0 before the event starts", () => {
    expect(eventProgress(EVENT_DATE, "09:00:00", "12:00:00", at(8, 0))).toBe(0);
  });

  it("returns 0 exactly at the start edge", () => {
    expect(eventProgress(EVENT_DATE, "09:00:00", "12:00:00", at(9, 0))).toBe(0);
  });

  it("returns 1 once the event has ended", () => {
    expect(eventProgress(EVENT_DATE, "09:00:00", "12:00:00", at(12, 0))).toBe(1);
  });

  it("returns 1 after the event ends", () => {
    expect(eventProgress(EVENT_DATE, "09:00:00", "12:00:00", at(13, 0))).toBe(1);
  });

  it("returns the linear fraction between the edges", () => {
    expect(eventProgress(EVENT_DATE, "09:00:00", "12:00:00", at(10, 30))).toBe(0.5);
  });

  it("scales with the event length", () => {
    expect(eventProgress(EVENT_DATE, "09:00:00", "13:00:00", at(12, 0))).toBe(0.75);
  });

  it("returns 0 when the start time is missing", () => {
    expect(eventProgress(EVENT_DATE, null, "12:00:00", at(10, 30))).toBe(0);
  });

  it("returns 0 when the end time is missing", () => {
    expect(eventProgress(EVENT_DATE, "09:00:00", null, at(10, 30))).toBe(0);
  });

  it("returns 0 when a time does not parse", () => {
    expect(eventProgress(EVENT_DATE, "oops", "12:00:00", at(10, 30))).toBe(0);
  });

  it("returns 0 when the end is before the start", () => {
    expect(eventProgress(EVENT_DATE, "12:00:00", "09:00:00", at(10, 30))).toBe(0);
  });

  it("returns 0 when end equals start", () => {
    expect(eventProgress(EVENT_DATE, "09:00:00", "09:00:00", at(10, 30))).toBe(0);
  });

  it("returns 0 without an event date", () => {
    expect(eventProgress("", "09:00:00", "12:00:00", at(10, 30))).toBe(0);
  });
});
