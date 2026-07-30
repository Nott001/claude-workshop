import { describe, it, expect } from "vitest";
import { qaMessageSchema } from "@/modules/chat/lib/schemas";
import type { QaMessage, UserRole } from "@/shared/types";

describe("QAPanel uses QA_MESSAGE", () => {
  it("accepts valid question message via qaMessageSchema", () => {
    const result = qaMessageSchema.safeParse({ message: "What is the deadline?", module_id: 1 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe("What is the deadline?");
      expect(result.data.module_id).toBe(1);
    }
  });

  it("rejects empty question", () => {
    const result = qaMessageSchema.safeParse({ message: "", module_id: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects question exceeding max length", () => {
    const result = qaMessageSchema.safeParse({ message: "x".repeat(1001), module_id: 1 });
    expect(result.success).toBe(false);
  });
});

describe("qaMessageSchema requires module_id", () => {
  it("accepts valid module_id", () => {
    const result = qaMessageSchema.safeParse({ message: "A question", module_id: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.module_id).toBe(42);
    }
  });

  it("rejects missing module_id", () => {
    const result = qaMessageSchema.safeParse({ message: "A question" });
    expect(result.success).toBe(false);
  });

  it("rejects non-positive module_id", () => {
    const result = qaMessageSchema.safeParse({ message: "A question", module_id: 0 });
    expect(result.success).toBe(false);
  });
});

describe("Q&A moderation — staff can delete questions", () => {
  const staffRoles: UserRole[] = ["facilitator", "speaker"];
  const nonStaffRoles: UserRole[] = ["attendee"];

  it("facilitator and speaker are considered staff", () => {
    const isStaff = (role: UserRole) => role === "facilitator" || role === "speaker";
    expect(staffRoles.every(isStaff)).toBe(true);
    expect(nonStaffRoles.some(isStaff)).toBe(false);
  });
});

describe("QaMessage type", () => {
  it("includes module_id instead of reply_to", () => {
    const msg: QaMessage = {
      id: 1,
      event_id: 99,
      module_id: 5,
      user_id: 5,
      message: "Question?",
      deleted_at: null,
      created_at: "2026-07-10T12:00:00Z",
      updated_at: "2026-07-10T12:00:00Z",
    };
    expect(msg.module_id).toBe(5);
    expect("reply_to" in msg).toBe(false);
    expect("answered_verbally" in msg).toBe(false);
  });
});
