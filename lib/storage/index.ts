export type StorageBucket = "event_images" | "profile_images" | "course_assets" | "course_videos";

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

export async function uploadToStorage(bucket: StorageBucket, path: string, file: File): Promise<{ url: string; path: string }> {
  const { getServiceClient } = await import("@/lib/db");
  const supabase = getServiceClient();

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const url = `/api/storage/${bucket}/${path}`;

  return { url, path };
}

export async function deleteFromStorage(bucket: StorageBucket, paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { getServiceClient } = await import("@/lib/db");
  const supabase = getServiceClient();

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.error(`Failed to delete files from ${bucket}:`, error.message);
  }
}

export async function listStorageFolder(bucket: StorageBucket, folder: string): Promise<string[]> {
  const { getServiceClient } = await import("@/lib/db");
  const supabase = getServiceClient();

  const { data, error } = await supabase.storage.from(bucket).list(folder);
  if (error) {
    console.error(`Failed to list folder ${folder} in ${bucket}:`, error.message);
    return [];
  }
  return (data ?? []).map((f) => `${folder}/${f.name}`);
}

export function buildEventImagePath(eventId: number, ext: string): string {
  return `events/${eventId}/cover.${ext}`;
}

export function buildProfileImagePath(userId: number, ext: string): string {
  return `users/${userId}/profile.${ext}`;
}

export function buildCourseAssetPath(courseId: number, moduleId: number, lessonId: number, filename: string): string {
  return `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/${filename}`;
}

export function buildCourseVideoPath(courseId: number, moduleId: number, lessonId: number, filename: string): string {
  return `courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/${filename}`;
}
