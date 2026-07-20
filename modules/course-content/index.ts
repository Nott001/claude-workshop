import { z } from "zod";
import type { ContentType } from "@/types";

export const contentTypes: ContentType[] = ["pdf", "video", "image", "link"];

export const courseSchema = z.object({
  course_name: z.string().min(1).max(255),
  course_description: z.string().nullable().optional(),
});

export const moduleSchema = z.object({
  module_name: z.string().min(1).max(255),
  sequence_order: z.coerce.number().int().min(1),
});

export const lessonSchema = z.object({
  description: z.string().min(1).max(255),
  content_type: z.enum(["pdf", "video", "image", "link"]),
  content_url: z.string().nullable().optional(),
  sequence_order: z.coerce.number().int().min(1),
});

export function getContentTypeIcon(type: ContentType): string {
  const icons: Record<ContentType, string> = {
    pdf: "FileText",
    video: "Video",
    image: "Image",
    link: "Link",
  };
  return icons[type];
}

export function getContentTypeLabel(type: ContentType): string {
  return type.toUpperCase();
}
