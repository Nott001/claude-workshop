/**
 * What each bucket accepts, and how its paths are named. Pure — no database or
 * storage client — so a browser component can check a file against the same
 * rules the route enforces without dragging the service-role client into the
 * client bundle. `index.ts` re-exports all of it; import from here only when
 * you are in a "use client" module.
 */

export const STORAGE_BUCKETS = ["event_images", "profile_images", "course_assets", "course_videos"] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/** Narrows an untrusted path segment to a bucket we actually serve. */
export function isStorageBucket(value: string): value is StorageBucket {
  return (STORAGE_BUCKETS as readonly string[]).includes(value);
}

/** Buckets holding paid course material, which requires an entitlement check. */
export const COURSE_CONTENT_BUCKETS: readonly StorageBucket[] = ["course_assets", "course_videos"];

const BUCKET_CONFIG: Record<StorageBucket, { allowedTypes: string[]; maxSizeBytes: number }> = {
  event_images: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxSizeBytes: 50 * 1024 * 1024,
  },
  profile_images: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxSizeBytes: 50 * 1024 * 1024,
  },
  course_assets: {
    allowedTypes: [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "text/plain",
      "application/zip",
    ],
    maxSizeBytes: 50 * 1024 * 1024,
  },
  course_videos: {
    allowedTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"],
    maxSizeBytes: 50 * 1024 * 1024,
  },
};

export function validateFileType(bucket: StorageBucket, mimeType: string): boolean {
  return BUCKET_CONFIG[bucket].allowedTypes.includes(mimeType);
}

export function validateFileSize(bucket: StorageBucket, size: number): boolean {
  return size <= BUCKET_CONFIG[bucket].maxSizeBytes;
}

/** The `accept` attribute for a file input on this bucket. */
export function acceptAttribute(bucket: StorageBucket): string {
  return BUCKET_CONFIG[bucket].allowedTypes.join(",");
}

export function maxSizeMb(bucket: StorageBucket): number {
  return Math.floor(BUCKET_CONFIG[bucket].maxSizeBytes / (1024 * 1024));
}

export function getExtensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "application/pdf": "pdf",
    "video/mp4": "mp4",
    "video/webm": "webm",
    "video/quicktime": "mov",
    "video/x-msvideo": "avi",
    "video/x-matroska": "mkv",
    "text/plain": "txt",
    "application/zip": "zip",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  };
  return map[mimeType] ?? "bin";
}

export function buildEventImagePath(eventId: number, ext: string): string {
  return `events/${eventId}/cover.${ext}`;
}

export function buildProfileImagePath(userId: number, ext: string): string {
  return `users/${userId}/profile_${Date.now()}.${ext}`;
}

export function buildCourseAssetPath(courseId: number, moduleId: number, lessonId: number, filename: string): string {
  return `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/${filename}`;
}

export function buildCourseVideoPath(courseId: number, moduleId: number, lessonId: number, filename: string): string {
  return `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/${filename}`;
}
