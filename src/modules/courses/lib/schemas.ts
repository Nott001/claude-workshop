import { z } from "zod";
import type { ContentType } from "@/shared/types";

export const contentTypes: ContentType[] = ["pdf", "video", "image", "link"];

export function getContentTypeLabel(type: ContentType): string {
  return type.toUpperCase();
}

const contentTypeEnum = z.enum(["pdf", "video", "image", "link"]);

export const courseSchema = z.object({
  course_name: z.string().min(1, "Name is required").max(255, "Name too long"),
  course_description: z.string().optional(),
  event_id: z.coerce.number().int().positive(),
});

export const moduleSchema = z.object({
  module_name: z.string().min(1, "Name is required"),
  sequence_order: z.coerce.number().int().positive("Must be at least 1"),
});

export const lessonSchema = z.object({
  description: z.string().min(1, "Description is required"),
  content_type: contentTypeEnum,
  content_url: z.string().optional(),
  sequence_order: z.coerce.number().int().positive("Must be at least 1"),
});
