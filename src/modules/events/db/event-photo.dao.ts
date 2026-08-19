import type { DbClient } from "@/shared/db/dao/types";
import { throwOnDbError } from "@/shared/db/dao/helpers";
import type { EventPhoto, EventPhotoPreview } from "@/shared/types";

/** The columns every read needs. `storage_path` is turned into `image_url` by
 *  `toEventPhoto`, so no caller has to know how the bucket is served. */
const PHOTO_COLUMNS = "id, event_id, storage_path, caption, sequence_order, created_at";

interface PhotoRow {
  id: number;
  event_id: number;
  storage_path: string;
  caption: string | null;
  sequence_order: number;
  created_at: string;
}

/** The one place an object key becomes a URL, so the route that serves the
 *  bucket can move without every consumer of a photo moving with it. */
function toEventPhoto(row: PhotoRow): EventPhoto {
  const { storage_path, ...rest } = row;
  return { ...rest, image_url: `/api/storage/event_images/${storage_path}` };
}

export async function listByEvent(supabase: DbClient, eventId: number): Promise<EventPhoto[]> {
  const { data, error } = await supabase
    .from("EVENT_PHOTO")
    .select(PHOTO_COLUMNS)
    .eq("event_id", eventId)
    .order("sequence_order", { ascending: true })
    .order("id", { ascending: true });

  throwOnDbError(error, "event-photo.dao.listByEvent");
  return (data ?? []).map(toEventPhoto);
}

/**
 * Previews for several events in one round trip.
 *
 * The memories strip renders a handful of cards and each wants a few thumbnails
 * and a total. Asking per card is an N+1 the strip would pay on every render,
 * so this fetches the whole set once and groups it here.
 *
 * PostgREST cannot limit rows *per group*, so the alternative to fetching every
 * row is a total that lies. The columns are three small scalars and the caller
 * bounds the event list, so the honest version is also the cheap one.
 */
export async function listPreviewsByEvents(
  supabase: DbClient,
  eventIds: number[],
  perEvent: number,
): Promise<Map<number, EventPhotoPreview>> {
  const previews = new Map<number, EventPhotoPreview>();
  // PostgREST reads an empty `in()` as vacuous and would return every photo in
  // the table — the same trap the facilitator listing documents.
  if (eventIds.length === 0) return previews;

  const { data, error } = await supabase
    .from("EVENT_PHOTO")
    .select(PHOTO_COLUMNS)
    .in("event_id", eventIds)
    .order("sequence_order", { ascending: true })
    .order("id", { ascending: true });

  throwOnDbError(error, "event-photo.dao.listPreviewsByEvents");

  for (const row of (data ?? []) as PhotoRow[]) {
    const preview = previews.get(row.event_id) ?? { photos: [], total: 0 };
    // Counted before the slice, so the total reports the archive rather than
    // the number of thumbnails that fit on a card.
    preview.total += 1;
    if (preview.photos.length < perEvent) preview.photos.push(toEventPhoto(row));
    previews.set(row.event_id, preview);
  }

  return previews;
}

export async function findById(supabase: DbClient, id: number): Promise<(EventPhoto & { storage_path: string }) | null> {
  const { data, error } = await supabase.from("EVENT_PHOTO").select(PHOTO_COLUMNS).eq("id", id).maybeSingle();

  throwOnDbError(error, "event-photo.dao.findById");
  if (!data) return null;
  const row = data as PhotoRow;
  return { ...toEventPhoto(row), storage_path: row.storage_path };
}

/** Every object key belonging to an event, for the sweep that runs when the
 *  event is deleted and takes these rows with it. */
export async function listStoragePathsByEvent(supabase: DbClient, eventId: number): Promise<string[]> {
  const { data, error } = await supabase.from("EVENT_PHOTO").select("storage_path").eq("event_id", eventId);

  throwOnDbError(error, "event-photo.dao.listStoragePathsByEvent");
  return (data ?? []).map((row: { storage_path: string }) => row.storage_path);
}

/** Where the next upload belongs in the sequence. A gallery appends, so a new
 *  photo sorts after everything already there rather than at an arbitrary spot. */
export async function nextSequenceOrder(supabase: DbClient, eventId: number): Promise<number> {
  const { data, error } = await supabase
    .from("EVENT_PHOTO")
    .select("sequence_order")
    .eq("event_id", eventId)
    .order("sequence_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  throwOnDbError(error, "event-photo.dao.nextSequenceOrder");
  return (data?.sequence_order ?? -1) + 1;
}

export interface CreateEventPhotoInput {
  event_id: number;
  storage_path: string;
  caption: string | null;
  sequence_order: number;
  uploaded_by: number;
}

export async function create(supabase: DbClient, input: CreateEventPhotoInput): Promise<EventPhoto | null> {
  const { data, error } = await supabase.from("EVENT_PHOTO").insert(input).select(PHOTO_COLUMNS).single();

  if (error) {
    console.error("event-photo.dao.create failed:", error.message, error.code);
    return null;
  }
  return toEventPhoto(data as PhotoRow);
}

export async function updateCaption(supabase: DbClient, id: number, caption: string | null): Promise<EventPhoto | null> {
  const { data, error } = await supabase
    .from("EVENT_PHOTO")
    .update({ caption, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PHOTO_COLUMNS)
    .single();

  if (error) {
    console.error("event-photo.dao.updateCaption failed:", error.message, error.code);
    return null;
  }
  return toEventPhoto(data as PhotoRow);
}

export async function remove(supabase: DbClient, id: number): Promise<boolean> {
  const { error } = await supabase.from("EVENT_PHOTO").delete().eq("id", id);
  return !error;
}
