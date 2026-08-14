import { describe, it, expect } from "vitest";
import { sendMessageSchema, supportTypeEnum } from "@/modules/chat/lib/schemas";
import { isRateLimited, RATE_LIMIT_MAX } from "@/shared/lib/rate-limit";
import type { ChatMessage, SupportType } from "@/shared/types";

describe("SupportType type", () => {
  it("accepts the only remaining support_type value", () => {
    const types: SupportType[] = ["general"];
    expect(types).toHaveLength(1);
  });
});

describe("ChatMessage type", () => {
  it("has correct shape", () => {
    const msg: ChatMessage = {
      id: 1,
      session_id: null,
      support_type: "general",
      user_id: 5,
      recipient_user_id: null,
      message: "Hello, world!",
      sent_at: "2026-07-10T12:00:00Z",
      deleted_at: null,
      updated_at: "2026-07-10T12:00:00Z",
    };
    expect(msg.id).toBe(1);
    expect(msg.support_type).toBe("general");
    expect(msg.message).toBe("Hello, world!");
  });

  it("accepts deleted_at with a value", () => {
    const msg: ChatMessage = {
      id: 2,
      session_id: null,
      support_type: "general",
      user_id: 3,
      recipient_user_id: null,
      message: "Need help",
      sent_at: "2026-07-10T12:00:00Z",
      deleted_at: "2026-07-10T12:05:00Z",
      updated_at: "2026-07-10T12:05:00Z",
    };
    expect(msg.deleted_at).toBeTruthy();
  });
});

describe("supportTypeEnum", () => {
  it("accepts 'general'", () => {
    const result = supportTypeEnum.safeParse("general");
    expect(result.success).toBe(true);
  });

  it("rejects the removed event branch", () => {
    const result = supportTypeEnum.safeParse("event");
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = supportTypeEnum.safeParse("dm");
    expect(result.success).toBe(false);
  });

  it("rejects old channel values", () => {
    const result = supportTypeEnum.safeParse("live_qa");
    expect(result.success).toBe(false);
  });
});

describe("sendMessageSchema", () => {
  it("accepts valid general support message", () => {
    const result = sendMessageSchema.safeParse({ support_type: "general", message: "Hello!" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.support_type).toBe("general");
      expect(result.data.message).toBe("Hello!");
    }
  });

  it("rejects the removed event support type", () => {
    const result = sendMessageSchema.safeParse({ support_type: "event", message: "Need help" });
    expect(result.success).toBe(false);
  });

  it("defaults support_type to general", () => {
    const result = sendMessageSchema.safeParse({ message: "Hello" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.support_type).toBe("general");
    }
  });

  it("rejects empty message", () => {
    const result = sendMessageSchema.safeParse({ message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects too-long message", () => {
    const result = sendMessageSchema.safeParse({ message: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid support_type", () => {
    const result = sendMessageSchema.safeParse({ support_type: "invalid", message: "Hello" });
    expect(result.success).toBe(false);
  });
});

describe("isRateLimited", () => {
  it("returns false when under limit", () => {
    expect(isRateLimited(0)).toBe(false);
    expect(isRateLimited(4)).toBe(false);
  });

  it("returns true when at limit", () => {
    expect(isRateLimited(RATE_LIMIT_MAX)).toBe(true);
  });

  it("returns true when over limit", () => {
    expect(isRateLimited(10)).toBe(true);
  });
});
