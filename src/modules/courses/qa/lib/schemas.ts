import { z } from "zod";

export const qaMessageSchema = z.object({
  message: z.string().min(1, "Message is required").max(1000, "Message too long"),
  module_id: z.number().int().positive(),
});
