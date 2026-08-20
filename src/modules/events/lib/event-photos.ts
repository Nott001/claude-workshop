import { ROLES } from "@/shared/lib/roles";
import type { DbClient } from "@/shared/db/dao/types";
import type { EventPhoto, EventPhotoPreview, UserRole } from "@/shared/types";
import type { EventListRow } from "@/modules/events/lib/event-crud";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import * as eventDao from "@/modules/events/db/event.dao";
import * as photoDao from "@/modules/events/db/event-photo.dao";
import { EventServiceError } from "@/modules/events/lib/event-errors";
import { loadEventOr403, type EventGuardUser } from "@/modules/events/lib/event-authz";
import { deleteFromStorage, uploadToStorage } from "@/shared/integrations/storage/service";
import {
  buildEventPhotoPath,
  getExtensionFromMimeType,
  oversizeMessage,
  validateFileSize,
  validateFileType,
} from "@/shared/integrations/storage/policy";

/** How many thumbnails a memory card shows before it stops being a card. */
export const MEMORY_PREVIEW_COUNT = 4;

/**
 * A photo is readable by exactly whoever may read its event, so the gate is the
 * event's own visibility rather than a second rule that can drift from it — the
 * same delegation the table's RLS policy makes.
 *
 * Any staff member clears a draft, not only one assigned to it, which is the
 * same floor `/api/storage/event_images/...` applies to the bytes themselves.
 * Tightening it here would refuse a list of objects the reader can already
 * fetch one by one, which buys nothing and reads as a rule until someone finds
 * the hole.
 */
async function requireReadableEvent(supabase: DbClient, eventId: number, role: UserRole | null): Promise<void> {
  const published = await eventDao.isPublished(supabase, eventId);
  if (published) return;

  // Indistinguishable from an event that does not exist: a draft's photo count
  // must not be a way to learn that the draft is there.
  if (!hasMinRole(role, ROLES.FACILITATOR)) {
    throw new EventServiceError(404, "Event not found");
  }
}

export async function listEventPhotos(supabase: DbClient, eventId: number, role: UserRole | null): Promise<EventPhoto[]> {
  await requireReadableEvent(supabase, eventId, role);
  return photoDao.listByEvent(supabase, eventId);
}

/**
 * Previews for a page of events in one query.
 *
 * Takes the ids the caller has already filtered and authorised rather than
 * selecting events itself: the memories strip and the staff listing decide what
 * a reader may see, and this only decorates that decision.
 */
export function listPhotoPreviews(
  supabase: DbClient,
  eventIds: number[],
  perEvent: number = MEMORY_PREVIEW_COUNT,
): Promise<Map<number, EventPhotoPreview>> {
  return photoDao.listPreviewsByEvents(supabase, eventIds, perEvent);
}

/**
 * Stores one photo and records it.
 *
 * The object is written before the row, so a failure between them leaves an
 * orphaned object rather than a row pointing at nothing — a row that renders a
 * broken image is the worse of the two, and the sweep in `deleteEvent` lists the
 * folder as well as the table precisely so an orphan is still collected.
 *
 * No caption is taken here. One is written afterwards, through the caption
 * endpoint, because that is the only way the manager sets one — accepting it in
 * two places would be two ways to do one thing, and the second would never run.
 */
export async function addEventPhoto(
  supabase: DbClient,
  eventId: number,
  user: EventGuardUser,
  file: File,
): Promise<EventPhoto> {
  await loadEventOr403(supabase, eventId, user, "photos");

  if (!validateFileType("event_images", file.type)) {
    throw new EventServiceError(400, "Only JPEG and PNG images are allowed.");
  }
  // Measured after the browser's resize — the bound on what the isolate holds,
  // not the size the reader was offered.
  if (!validateFileSize("event_images", file.size)) {
    throw new EventServiceError(400, oversizeMessage("event_images"));
  }

  const path = buildEventPhotoPath(eventId, getExtensionFromMimeType(file.type));
  // Read before the upload rather than in a constraint, because two photos
  // landing on the same number is not a fault — the gallery's ordering breaks
  // the tie on `id`, so they simply sit next to each other in arrival order.
  const sequenceOrder = await photoDao.nextSequenceOrder(supabase, eventId);

  await uploadToStorage("event_images", path, file);

  const photo = await photoDao.create(supabase, {
    event_id: eventId,
    storage_path: path,
    caption: null,
    sequence_order: sequenceOrder,
    uploaded_by: user.id,
  });

  if (!photo) {
    // The row is the record; without it the object is unreachable, so it goes
    // back rather than lingering as a cost nobody can see.
    await deleteFromStorage("event_images", [path]);
    throw new EventServiceError(500, "Failed to save the photo.");
  }

  return photo;
}

export async function updateEventPhotoCaption(
  supabase: DbClient,
  eventId: number,
  photoId: number,
  user: EventGuardUser,
  caption: string | null,
): Promise<EventPhoto> {
  await loadEventOr403(supabase, eventId, user, "photos");
  await requirePhotoOfEvent(supabase, eventId, photoId);

  const photo = await photoDao.updateCaption(supabase, photoId, normaliseCaption(caption));
  if (!photo) {
    throw new EventServiceError(500, "Failed to update the caption.");
  }
  return photo;
}

export async function removeEventPhoto(
  supabase: DbClient,
  eventId: number,
  photoId: number,
  user: EventGuardUser,
): Promise<void> {
  await loadEventOr403(supabase, eventId, user, "photos");
  const photo = await requirePhotoOfEvent(supabase, eventId, photoId);

  if (!(await photoDao.remove(supabase, photoId))) {
    throw new EventServiceError(500, "Failed to remove the photo.");
  }

  // After the row, and best-effort: a deleted row with its object still in the
  // bucket costs storage, while a deleted object with its row still present
  // renders a broken image on a public page.
  await deleteFromStorage("event_images", [photo.storage_path]);
}

/**
 * The photo id arrives in the URL beside the event id, and nothing ties them
 * together but this check — without it, a facilitator assigned to one event can
 * delete any photo of any other by guessing its id.
 */
async function requirePhotoOfEvent(supabase: DbClient, eventId: number, photoId: number) {
  const photo = await photoDao.findById(supabase, photoId);
  if (!photo || photo.event_id !== eventId) {
    throw new EventServiceError(404, "Photo not found");
  }
  return photo;
}

/** An empty caption box means "no caption", not a caption that is the empty
 *  string — otherwise the gallery renders a blank line under the photo. */
function normaliseCaption(caption: string | null): string | null {
  const trimmed = caption?.trim();
  return trimmed ? trimmed : null;
}

/**
 * One finished event as the memories strip renders it: the event's own summary
 * fields plus the head of its archive and how big that archive is.
 */
export interface EventMemory {
  event: EventListRow;
  photos: EventPhoto[];
  photo_count: number;
}

/** The strip is a grid three cards wide; more than one row of finished events
 *  turns a highlight into an index the /events page already provides. */
export const MEMORY_EVENT_LIMIT = 3;

/**
 * The memories strip's read, whole.
 *
 * Deliberately its own function rather than a flag on `listEvents`: every other
 * listing renders a card that has no archive behind it, and decorating them all
 * with photos would pay for a second query on the staff table, the public list
 * and the landing page to feed one strip on /community.
 *
 * Reads as the anonymous listing does — published events only, no assignment
 * scoping — because /community renders to visitors with no session.
 */
export async function listEventMemories(supabase: DbClient, limit: number = MEMORY_EVENT_LIMIT): Promise<EventMemory[]> {
  const { data: events } = await eventDao.list(supabase, {
    role: null,
    userId: null,
    filter: "past",
    limit,
  });

  if (events.length === 0) return [];

  const previews = await listPhotoPreviews(
    supabase,
    events.map((event) => event.id),
  );

  // An event with no photos still gets a card. Hiding it would silently shrink
  // the archive the moment a session went unphotographed, and the card degrades
  // to exactly what it renders today.
  return events.map((event) => {
    const preview = previews.get(event.id);
    return { event, photos: preview?.photos ?? [], photo_count: preview?.total ?? 0 };
  });
}
