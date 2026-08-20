/**
 * What each bucket accepts, and how its paths are named. Pure — no database or
 * storage client — so a browser component can check a file against the same
 * rules the route enforces without dragging the service-role client into the
 * client bundle.
 */

export const STORAGE_BUCKETS = ["event_images", "profile_images", "course_assets", "course_videos"] as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[number];

/** Narrows an untrusted path segment to a bucket we actually serve. */
export function isStorageBucket(value: string): value is StorageBucket {
  return (STORAGE_BUCKETS as readonly string[]).includes(value);
}

/** Buckets holding paid course material, which requires an entitlement check. */
export const COURSE_CONTENT_BUCKETS: readonly StorageBucket[] = ["course_assets", "course_videos"];

/**
 * `noun` and `refusal` are here rather than at the call sites because the rule
 * and the sentence explaining it drift apart otherwise: a type added to a
 * bucket used to leave a message behind naming the old set.
 */
const MB = 1024 * 1024;

/**
 * Two limits, because the file is measured twice against different concerns.
 *
 * `maxSourceBytes` is what a person may *choose*, checked in the browser before
 * `resizeImage` runs. It stays generous: a phone routinely produces 10-25 MB,
 * and every one of those resizes down to a few hundred KB, so rejecting on the
 * original size would refuse files that upload perfectly well.
 *
 * `maxUploadBytes` is what may *arrive at the server*, checked after that
 * resize. It bounds what a 128 MB isolate has to hold, and for images it sits
 * far above anything the resizer emits — it exists for the paths that skip the
 * resizer: a browser that cannot decode the image, and a direct POST.
 *
 * They are equal wherever nothing shrinks the file. `resizeImage` only handles
 * JPEG and PNG, so videos and documents arrive exactly as they were picked.
 */
const BUCKET_CONFIG: Record<
  StorageBucket,
  { allowedTypes: string[]; maxSourceBytes: number; maxUploadBytes: number; noun: string; refusal: string }
> = {
  event_images: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxSourceBytes: 50 * MB,
    maxUploadBytes: 8 * MB,
    noun: "Image",
    refusal: "Only JPEG and PNG images are allowed.",
  },
  profile_images: {
    allowedTypes: ["image/jpeg", "image/png"],
    maxSourceBytes: 50 * MB,
    maxUploadBytes: 8 * MB,
    noun: "Image",
    refusal: "Only JPEG and PNG images are allowed.",
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
    // Not resized, so what is picked is what arrives.
    maxSourceBytes: 50 * MB,
    maxUploadBytes: 50 * MB,
    noun: "File",
    refusal: "That file type is not accepted for course material.",
  },
  course_videos: {
    allowedTypes: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo", "video/x-matroska"],
    // Not resized either. Lowering this would restrict course material rather
    // than protect anything; the fix for the memory it costs is to keep the
    // bytes out of the isolate, not to accept smaller lectures.
    maxSourceBytes: 50 * MB,
    maxUploadBytes: 50 * MB,
    noun: "Video",
    refusal: "Only MP4, WebM, MOV, AVI and MKV videos are allowed.",
  },
};

/** The one place a size limit is turned into a sentence, so the two limits
 * cannot end up described in two different shapes. */
function underLimitMessage(bucket: StorageBucket, bytes: number): string {
  return `${BUCKET_CONFIG[bucket].noun} must be under ${Math.floor(bytes / MB)} MB.`;
}

/** Why this bucket refuses the file the reader picked, or null if it does not.
 * Measures the original, before any resize, so it must use the source limit. */
export function describeRejection(bucket: StorageBucket, file: File): string | null {
  if (!validateFileType(bucket, file.type)) return BUCKET_CONFIG[bucket].refusal;
  if (!validateSourceSize(bucket, file.size)) return underLimitMessage(bucket, BUCKET_CONFIG[bucket].maxSourceBytes);
  return null;
}

export function validateFileType(bucket: StorageBucket, mimeType: string): boolean {
  return BUCKET_CONFIG[bucket].allowedTypes.includes(mimeType);
}

/** Whether a file may be *chosen*. Pre-resize, so this is the generous one. */
export function validateSourceSize(bucket: StorageBucket, size: number): boolean {
  return size <= BUCKET_CONFIG[bucket].maxSourceBytes;
}

/** Whether a file may be *accepted by the server*. Post-resize, and the bound
 * on what the isolate has to hold. */
export function validateFileSize(bucket: StorageBucket, size: number): boolean {
  return size <= BUCKET_CONFIG[bucket].maxUploadBytes;
}

/**
 * What to tell someone the server refused on size.
 *
 * Where a resize stands between the two limits, reaching here means the browser
 * could not shrink the file, and quoting the server's threshold would only
 * confuse — they were told a larger number and it was true. Where the two
 * limits are equal nothing shrank anything, so the plain limit is the honest
 * answer, and reaching here at all means the pre-flight was bypassed.
 */
export function oversizeMessage(bucket: StorageBucket): string {
  const { noun, maxSourceBytes, maxUploadBytes } = BUCKET_CONFIG[bucket];
  if (maxSourceBytes === maxUploadBytes) return underLimitMessage(bucket, maxUploadBytes);
  return `${noun} could not be processed in your browser. Try a smaller one.`;
}

/** The `accept` attribute for a file input on this bucket. */
export function acceptAttribute(bucket: StorageBucket): string {
  return BUCKET_CONFIG[bucket].allowedTypes.join(",");
}

/** The number shown to whoever is choosing a file, so it is the source limit —
 * the server's is not a size they can act on. */
export function maxSizeMb(bucket: StorageBucket): number {
  return Math.floor(BUCKET_CONFIG[bucket].maxSourceBytes / MB);
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

/**
 * One photo in an event's archive.
 *
 * Under the same `events/{id}/` prefix the cover uses, because that prefix is
 * what the storage route reads to decide who may see the object — a photo of a
 * published event is public for the same reason its cover is, and stays behind
 * the facilitator floor while the event is a draft.
 *
 * A random name rather than a counter or a timestamp: several files are picked
 * at once and uploaded concurrently, so anything derived from the clock or from
 * the number of existing photos collides and one upload silently overwrites
 * another. The key is also the table's unique column, which is what makes a
 * retried upload idempotent instead of duplicated.
 */
export function buildEventPhotoPath(eventId: number, ext: string): string {
  return `events/${eventId}/photos/${crypto.randomUUID()}.${ext}`;
}

/** The folder every photo of an event sits in, and the one a cleanup lists. */
export function eventPhotoFolder(eventId: number): string {
  return `events/${eventId}/photos`;
}

export function buildProfileImagePath(userId: number, ext: string): string {
  return `users/${userId}/profile_${Date.now()}.${ext}`;
}

/**
 * Reduces an untrusted client filename to its final path segment so an object
 * key built from it can never escape the lesson's folder, and drops a name that
 * is only dots — the traversal payload itself — in favour of the fallback.
 */
export function sanitizeObjectName(name: string, fallback: string): string {
  const base = name.replace(/\\/g, "/").split("/").filter(Boolean).pop() ?? "";
  return base.replace(/^\.+|\.+$/g, "") || fallback;
}

export function buildCourseAssetPath(courseId: number, moduleId: number, lessonId: number, filename: string): string {
  return `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/${filename}`;
}

export function buildCourseVideoPath(courseId: number, moduleId: number, lessonId: number, filename: string): string {
  return `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/${filename}`;
}
