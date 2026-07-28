import { z } from "zod";

export const chatChannelEnum = z.enum(["support", "live_qa"]);

export const sendMessageSchema = z.object({
  channel: chatChannelEnum,
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
  reply_to: z.number().int().positive().optional(),
  recipient_user_id: z.number().int().positive().optional(),
  answered_verbally: z.boolean().optional(),
});

export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX = 5;

export function isRateLimited(messageCount: number): boolean {
  return messageCount >= RATE_LIMIT_MAX;
}
