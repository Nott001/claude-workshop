import { describe, it, expect } from "vitest";
import { sendMessageSchema, chatChannelEnum, isRateLimited, RATE_LIMIT_MAX } from "@/modules/chat";
import type { ChatMessage, ChatChannel } from "@/shared/types";

describe("ChatChannel type", () => {
  it("accepts valid channel values", () => {
    const channels: ChatChannel[] = ["support", "live_qa"];
    expect(channels).toHaveLength(2);
  });
});

describe("ChatMessage type", () => {
  it("has correct shape", () => {
    const msg: ChatMessage = {
      id: 1,
      event_id: 1,
      session_id: null,
      channel: "live_qa",
      user_id: 5,
      recipient_user_id: null,
      message: "Hello, world!",
      sent_at: "2026-07-10T12:00:00Z",
      deleted_at: null,
      updated_at: "2026-07-10T12:00:00Z",
      reply_to: null,
      answered_verbally: false,
    };
    expect(msg.id).toBe(1);
    expect(msg.channel).toBe("live_qa");
    expect(msg.message).toBe("Hello, world!");
  });

  it("accepts deleted_at with a value", () => {
    const msg: ChatMessage = {
      id: 2,
      event_id: 1,
      session_id: null,
      channel: "support",
      user_id: 3,
      recipient_user_id: null,
      message: "Need help",
      sent_at: "2026-07-10T12:00:00Z",
      deleted_at: "2026-07-10T12:05:00Z",
      updated_at: "2026-07-10T12:05:00Z",
      reply_to: null,
      answered_verbally: false,
    };
    expect(msg.deleted_at).toBeTruthy();
  });
});

describe("chatChannelEnum", () => {
  it("accepts 'support'", () => {
    const result = chatChannelEnum.safeParse("support");
    expect(result.success).toBe(true);
  });

  it("accepts 'live_qa'", () => {
    const result = chatChannelEnum.safeParse("live_qa");
    expect(result.success).toBe(true);
  });

  it("rejects invalid channel", () => {
    const result = chatChannelEnum.safeParse("dm");
    expect(result.success).toBe(false);
  });

  it("rejects global_support", () => {
    const result = chatChannelEnum.safeParse("global_support");
    expect(result.success).toBe(false);
  });
});

describe("sendMessageSchema", () => {
  it("accepts valid message", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "Hello!" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe("live_qa");
      expect(result.data.message).toBe("Hello!");
    }
  });

  it("accepts support channel", () => {
    const result = sendMessageSchema.safeParse({ channel: "support", message: "Need help" });
    expect(result.success).toBe(true);
  });

  it("rejects global_support channel", () => {
    const result = sendMessageSchema.safeParse({ channel: "global_support", message: "Need help" });
    expect(result.success).toBe(false);
  });

  it("accepts support with reply_to", () => {
    const result = sendMessageSchema.safeParse({ channel: "support", message: "Reply", reply_to: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reply_to).toBe(42);
    }
  });

  it("rejects empty message", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects too-long message", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });

  it("rejects invalid channel", () => {
    const result = sendMessageSchema.safeParse({ channel: "invalid", message: "Hello" });
    expect(result.success).toBe(false);
  });

  it("rejects missing channel", () => {
    const result = sendMessageSchema.safeParse({ message: "Hello" });
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
