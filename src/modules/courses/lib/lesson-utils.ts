import type { StorageBucket } from "@/shared/integrations/storage/policy";

export function detectContentType(file: File | null, url: string): string {
  void url;
  if (file) {
    if (file.type.startsWith("video/")) return "video";
    if (file.type === "application/pdf") return "pdf";
    return "image";
  }
  return "link";
}

export function normalizeUrl(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }
  return url;
}

// Images ride in `course_assets` alongside documents — the bucket has accepted
// image/jpeg and image/png all along. Leaving them out here meant a picked
// image was never posted anywhere: the lesson was created with no content_url
// and the file was dropped without a word.
export function getUploadEndpoint(contentType: string): string | undefined {
  if (contentType === "video") return "/api/upload/course-video";
  if (contentType === "pdf" || contentType === "image") return "/api/upload/course-asset";
  return undefined;
}

/** The bucket behind `getUploadEndpoint`, so the browser can apply its rules. */
export function uploadBucket(contentType: string): StorageBucket | undefined {
  if (contentType === "video") return "course_videos";
  if (contentType === "pdf" || contentType === "image") return "course_assets";
  return undefined;
}
