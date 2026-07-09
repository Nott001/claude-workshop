import { z } from "zod";

export const liveSessionUpdateSchema = z.object({
  current_lesson_id: z.coerce.number().int().positive().nullable(),
});
