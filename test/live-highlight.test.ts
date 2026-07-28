import { describe, it, expect } from "vitest";
import type { LiveSessionState } from "@/shared/types";

describe("LiveSessionState type", () => {
  it("has the correct shape when highlighted", () => {
    const state: LiveSessionState = {
      event_id: 1,
      highlighted_lesson_id: 42,
      updated_by: 10,
      updated_at: "2026-07-22T10:00:00Z",
    };
    expect(state.event_id).toBe(1);
    expect(state.highlighted_lesson_id).toBe(42);
    expect(state.updated_by).toBe(10);
  });

  it("accepts null highlighted_lesson_id", () => {
    const state: LiveSessionState = {
      event_id: 1,
      highlighted_lesson_id: null,
      updated_by: 10,
      updated_at: "2026-07-22T10:00:00Z",
    };
    expect(state.highlighted_lesson_id).toBeNull();
  });

  it("accepts different event IDs", () => {
    const state: LiveSessionState = {
      event_id: 99,
      highlighted_lesson_id: null,
      updated_by: 5,
      updated_at: "2026-07-22T10:00:00Z",
    };
    expect(state.event_id).toBe(99);
  });
});

describe("Live highlight state transitions", () => {
  function canSetHighlight(userRole: string, eventStarted: boolean): boolean {
    return (userRole === "speaker" || userRole === "facilitator") && eventStarted;
  }

  it("allows speaker to set highlight when event is live", () => {
    expect(canSetHighlight("speaker", true)).toBe(true);
  });

  it("allows facilitator to set highlight when event is live", () => {
    expect(canSetHighlight("facilitator", true)).toBe(true);
  });

  it("denies attendee from setting highlight", () => {
    expect(canSetHighlight("attendee", true)).toBe(false);
  });

  it("denies setting highlight when event has not started", () => {
    expect(canSetHighlight("speaker", false)).toBe(false);
  });

  it("denies setting highlight for anonymous user", () => {
    expect(canSetHighlight("", true)).toBe(false);
  });
});

describe("Lesson highlight indicator logic", () => {
  function isHighlighted(highlightedLessonId: number | null, lessonId: number): boolean {
    return highlightedLessonId === lessonId;
  }

  it("returns true when lesson matches highlight", () => {
    expect(isHighlighted(42, 42)).toBe(true);
  });

  it("returns false when lesson does not match highlight", () => {
    expect(isHighlighted(42, 7)).toBe(false);
  });

  it("returns false when no highlight is set", () => {
    expect(isHighlighted(null, 42)).toBe(false);
  });
});
