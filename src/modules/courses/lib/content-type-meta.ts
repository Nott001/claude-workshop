import type { ContentType } from "@/shared/types";

const META: Record<ContentType, { icon: string; label: string }> = {
  pdf: { icon: "picture_as_pdf", label: "PDF" },
  video: { icon: "play_circle", label: "Video" },
  image: { icon: "image", label: "Image" },
  link: { icon: "link", label: "Link" },
};

export function contentTypeMeta(type: ContentType): { icon: string; label: string } {
  return META[type];
}
