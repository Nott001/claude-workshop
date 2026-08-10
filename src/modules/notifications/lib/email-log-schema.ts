import { z } from "zod";

const emailTypeEnum = z.enum(["ticket_issued", "check_in_confirmed", "event_survey"]);
const emailStatusEnum = z.enum(["sent", "failed"]);

export const emailLogFilterSchema = z.object({
  email_type: emailTypeEnum.optional(),
  status: emailStatusEnum.optional(),
  user_id: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});
