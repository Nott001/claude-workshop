import { z } from "zod";
import type { ContentType } from "@/shared/types";

export const contentTypes: ContentType[] = ["pdf", "video", "image", "link"];

export function getContentTypeLabel(type: ContentType): string {
  return type.toUpperCase();
}

const contentTypeEnum = z.enum(["pdf", "video", "image", "link"]);

export const courseSchema = z.object({
  course_name: z.string().min(1, "Name is required").max(255, "Name too long"),
  // The DAO stores no description as null, and the create flow sends null when
  // the description is empty — so null is as valid as a string here.
  course_description: z.string().optional().nullable(),
  event_id: z.coerce.number().int().positive(),
});

const timeField = z.union([z.null(), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Must be HH:mm")]);

const speakerProfileId = z.union([z.null(), z.coerce.number().int().positive("Must be a positive int")]);

export const moduleSchema = z
  .object({
    module_name: z.string().min(1, "Name is required"),
    sequence_order: z.coerce.number().int().positive("Must be at least 1"),
    module_type: z.enum(["lessons", "qa"]).default("lessons"),
    start_time: timeField.optional(),
    end_time: timeField.optional(),
    speaker_profile_id: speakerProfileId.optional(),
  })
  .superRefine((data, ctx) => {
    const { start_time: start, end_time: end } = data;
    if (start === undefined && end === undefined) return;
    // Both null is the clear form; a lone null is a partial pair, so the clear
    // and set forms both send both keys.
    if (start === null && end === null) return;
    if (start === undefined || end === undefined || start === null || end === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["start_time"],
        message: "start_time and end_time must be set together",
      });
      return;
    }
    // Zero-padded HH:mm orders correctly as strings, so no time arithmetic.
    if (end <= start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["end_time"], message: "end_time must be after start_time" });
    }
  });

export const qaModuleSchema = z.object({
  module_name: z.string().min(1, "Name is required"),
  sequence_order: z.coerce.number().int().positive("Must be at least 1"),
  is_locked: z.boolean().optional(),
});

export const lessonSchema = z.object({
  description: z.string().min(1, "Description is required"),
  content_type: contentTypeEnum,
  content_url: z.string().optional(),
  // Present only when a lesson is moved to another module.
  module_id: z.coerce.number().int().positive().optional(),
  sequence_order: z.coerce.number().int().positive("Must be at least 1"),
});
