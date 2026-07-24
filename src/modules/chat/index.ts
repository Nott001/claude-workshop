import { z } from "zod";

export const chatChannelEnum = z.enum(["support", "live_qa", "global_support"]);

export const sendMessageSchema = z.object({
  channel: chatChannelEnum,
  message: z.string().min(1).max(1000),
  reply_to: z.number().int().positive().nullish(),
  answered_verbally: z.boolean().optional(),
  recipient_user_id: z.number().int().positive().nullish(),
});

export function isRateLimited(messagesInWindow: number): boolean {
  return messagesInWindow >= 5;
}

export const RATE_LIMIT_WINDOW_MS = 10_000;
export const RATE_LIMIT_MAX = 5;
