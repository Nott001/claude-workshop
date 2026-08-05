import type { StorageBucket } from "./policy";

export async function uploadToStorage(bucket: StorageBucket, path: string, file: File): Promise<{ url: string; path: string }> {
  const { getServiceClient } = await import("@/shared/db/client");
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
  const { getServiceClient } = await import("@/shared/db/client");
  const supabase = getServiceClient();

  const { error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    console.error(`Failed to delete files from ${bucket}:`, error.message);
  }
}

export async function listStorageFolder(bucket: StorageBucket, folder: string): Promise<string[]> {
  const { getServiceClient } = await import("@/shared/db/client");
  const supabase = getServiceClient();

  const { data, error } = await supabase.storage.from(bucket).list(folder);
  if (error) {
    console.error(`Failed to list folder ${folder} in ${bucket}:`, error.message);
    return [];
  }
  return (data ?? []).map((f) => `${folder}/${f.name}`);
}
