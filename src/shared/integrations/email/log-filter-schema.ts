import { z } from "zod";
import { EMAIL_TYPES, EMAIL_STATUSES } from "@/shared/types";

export const emailLogFilterSchema = z.object({
  email_type: z.enum(EMAIL_TYPES).optional(),
  status: z.enum(EMAIL_STATUSES).optional(),
  user_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});
