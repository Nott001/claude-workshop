import { z } from "zod";

export const supportTypeEnum = z.enum(["general", "event"]);

export const sendMessageSchema = z.object({
  support_type: supportTypeEnum.default("general"),
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
  recipient_user_id: z.number().int().positive().optional(),
});

export const qaMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
  module_id: z.number().int().positive(),
});
