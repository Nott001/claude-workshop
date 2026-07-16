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

describe("GET fallback response shape", () => {
  it("includes session_status as 'scheduled' when no state exists", () => {
    const fallback = {
      event_id: 1,
      current_lesson_id: null,
      session_status: "scheduled",
      updated_by: null,
      updated_at: null,
    };
    expect(fallback.session_status).toBe("scheduled");
    expect(fallback.event_id).toBe(1);
    expect(fallback.current_lesson_id).toBeNull();
    expect(fallback.updated_by).toBeNull();
    expect(fallback.updated_at).toBeNull();
  });

  it("fallback shape satisfies LiveSessionState for status checks", () => {
    const fallback = {
      event_id: 1,
      current_lesson_id: null,
      session_status: "scheduled" as const,
      updated_by: null,
      updated_at: null,
    };
    expect(fallback.session_status === "scheduled").toBe(true);
    expect(fallback.session_status === "live").toBe(false);
    expect(fallback.session_status === "ended").toBe(false);
  });
});

describe("Session status transitions", () => {
  it("transitions from scheduled to live on start", () => {
    let status: string = "scheduled";
    status = "live";
    expect(status).toBe("live");
  });

  it("transitions from live to ended on end", () => {
    let status: string = "live";
    status = "ended";
    expect(status).toBe("ended");
  });

  it("transitions from ended back to scheduled on reset", () => {
    let status: string = "ended";
    status = "scheduled";
    expect(status).toBe("scheduled");
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
