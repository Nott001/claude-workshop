import { describe, it, expect } from "vitest";
import { liveSessionUpdateSchema } from "@/modules/live-session";
import type { LiveSessionState } from "@/types";

describe("LiveSessionState type", () => {
  it("has correct shape with current_lesson_id", () => {
    const state: LiveSessionState = {
      event_id: 1,
      current_lesson_id: 42,
      session_status: "live",
      updated_by: 5,
      updated_at: "2026-07-09T12:00:00Z",
    };
    expect(state.event_id).toBe(1);
    expect(state.current_lesson_id).toBe(42);
    expect(state.session_status).toBe("live");
    expect(state.updated_by).toBe(5);
  });

  it("has correct shape with null current_lesson_id", () => {
    const state: LiveSessionState = {
      event_id: 1,
      current_lesson_id: null,
      session_status: "scheduled",
      updated_by: 5,
      updated_at: "2026-07-09T12:00:00Z",
    };
    expect(state.current_lesson_id).toBeNull();
    expect(state.session_status).toBe("scheduled");
  });

  it("accepts ended session_status", () => {
    const state: LiveSessionState = {
      event_id: 1,
      current_lesson_id: null,
      session_status: "ended",
      updated_by: 5,
      updated_at: "2026-07-09T14:00:00Z",
    };
    expect(state.session_status).toBe("ended");
  });
});

describe("liveSessionUpdateSchema", () => {
  it("accepts valid lesson_id", () => {
    const result = liveSessionUpdateSchema.safeParse({ current_lesson_id: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.current_lesson_id).toBe(42);
    }
  });

  it("accepts null lesson_id", () => {
    const result = liveSessionUpdateSchema.safeParse({ current_lesson_id: null });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.current_lesson_id).toBeNull();
    }
  });

  it("accepts string-coercible lesson_id", () => {
    const result = liveSessionUpdateSchema.safeParse({ current_lesson_id: "42" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.current_lesson_id).toBe(42);
    }
  });

  it("rejects missing current_lesson_id", () => {
    const result = liveSessionUpdateSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects negative lesson_id", () => {
    const result = liveSessionUpdateSchema.safeParse({ current_lesson_id: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects zero lesson_id", () => {
    const result = liveSessionUpdateSchema.safeParse({ current_lesson_id: 0 });
    expect(result.success).toBe(false);
  });
});
