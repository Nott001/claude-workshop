import { describe, it, expect } from "vitest";
import { chatChannelEnum, sendMessageSchema } from "@/modules/chat";

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
