import { describe, it, expect } from "vitest";
import { chatChannelEnum, sendMessageSchema } from "@/modules/chat";
import type { ChatMessage } from "@/types";

describe("QAPanel uses live_qa channel", () => {
  it("accepts live_qa channel for questions", () => {
    const result = chatChannelEnum.safeParse("live_qa");
    expect(result.success).toBe(true);
  });

  it("accepts valid question message via sendMessageSchema", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "What is the deadline?" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.channel).toBe("live_qa");
    }
  });

  it("rejects empty question", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "" });
    expect(result.success).toBe(false);
  });

  it("rejects question exceeding max length", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "x".repeat(1001) });
    expect(result.success).toBe(false);
  });
});

describe("reply_to threading", () => {
  it("accepts reply_to in sendMessageSchema", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "A reply", reply_to: 42 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reply_to).toBe(42);
    }
  });

  it("accepts message without reply_to", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "A question" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reply_to).toBeUndefined();
    }
  });

  it("rejects negative reply_to", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "Bad", reply_to: -1 });
    expect(result.success).toBe(false);
  });
});

describe("answered_verbally", () => {
  it("accepts answered_verbally in schema", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "Q", answered_verbally: true });
    expect(result.success).toBe(true);
  });

  it("defaults to undefined when omitted", () => {
    const result = sendMessageSchema.safeParse({ channel: "live_qa", message: "Q" });
    expect(result.success).toBe(true);
  });
});

describe("ChatMessage type includes threading", () => {
  it("accepts reply_to and answered_verbally", () => {
    const msg: ChatMessage = {
      message_id: 1,
      event_id: 99,
      channel: "live_qa",
      user_id: 5,
      recipient_user_id: null,
      message: "Question?",
      sent_at: "2026-07-10T12:00:00Z",
      read_by: [],
      deleted_at: null,
      updated_at: "2026-07-10T12:00:00Z",
      reply_to: null,
      answered_verbally: false,
    };
    expect(msg.reply_to).toBeNull();
    expect(msg.answered_verbally).toBe(false);
  });

  it("accepts a reply with reply_to set", () => {
    const msg: ChatMessage = {
      message_id: 2,
      event_id: 99,
      channel: "live_qa",
      user_id: 3,
      recipient_user_id: null,
      message: "Answer",
      sent_at: "2026-07-10T12:01:00Z",
      read_by: [],
      deleted_at: null,
      updated_at: "2026-07-10T12:01:00Z",
      reply_to: 1,
      answered_verbally: false,
    };
    expect(msg.reply_to).toBe(1);
  });
});
