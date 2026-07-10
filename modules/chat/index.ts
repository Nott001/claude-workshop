import { z } from "zod";

export const chatChannelEnum = z.enum(["support", "live_qa"]);

export const sendMessageSchema = z.object({
  channel: chatChannelEnum,
  message: z.string().min(1).max(1000),
});

export function isRateLimited(messagesInWindow: number): boolean {
  return messagesInWindow >= 5;
}

export const RATE_LIMIT_WINDOW_MS = 10_000;
export const RATE_LIMIT_MAX = 5;
