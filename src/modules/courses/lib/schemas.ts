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

export const moduleSchema = z.object({
  module_name: z.string().min(1, "Name is required"),
  sequence_order: z.coerce.number().int().positive("Must be at least 1"),
  module_type: z.enum(["lessons", "qa"]).default("lessons"),
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
