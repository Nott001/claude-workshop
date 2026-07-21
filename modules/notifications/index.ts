import { z } from "zod";

export const emailTypeEnum = z.enum(["ticket_issued", "check_in_confirmed"]);

export const emailStatusEnum = z.enum(["sent", "failed"]);

export type EmailType = z.infer<typeof emailTypeEnum>;
export type EmailStatus = z.infer<typeof emailStatusEnum>;

export const emailLogInsertSchema = z.object({
  user_id: z.number().int().positive(),
  email_type: emailTypeEnum,
  status: emailStatusEnum,
  sent_at: z.string().nullable().optional(),
});

export const emailLogFilterSchema = z.object({
  email_type: emailTypeEnum.optional(),
  status: emailStatusEnum.optional(),
  user_id: z.coerce.number().int().positive().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});
