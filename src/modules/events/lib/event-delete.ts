import type { DbClient } from "@/shared/db/dao/types";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import * as eventDao from "@/modules/events/db/event.dao";
import * as photoDao from "@/modules/events/db/event-photo.dao";
import * as courseDao from "@/shared/db/dao/course.dao";
import { deleteFromStorage, listStorageFolder } from "@/shared/integrations/storage/service";
import { eventPhotoFolder, type StorageBucket } from "@/shared/integrations/storage/policy";
import { EventServiceError } from "@/modules/events/lib/event-errors";
import type { EventActor } from "@/modules/events/lib/event-authz";

type StoragePathsByBucket = Record<"event_images" | "course_assets" | "course_videos", string[]>;

async function collectStoragePaths(
  supabase: DbClient,
  event: Awaited<ReturnType<typeof eventDao.findById>>,
): Promise<StoragePathsByBucket> {
  // Kept per bucket: a path is only meaningful to the bucket it was listed
  // from, so one flat list cannot be deleted from.
  const pathsByBucket: StoragePathsByBucket = {
    event_images: [],
    course_assets: [],
    course_videos: [],
  };

  if (event?.id) {
    // Not gated on `cover_image_url` any more. That test read as "does this
    // event have images", and stopped being true the moment an event could hold
    // photos without ever having had a cover — the whole folder was then left
    // in the bucket.
    //
    // The cover and the photo folder are listed separately because
    // `listStorageFolder` wraps `storage.list()`, which does not recurse: asked
    // for `events/{id}` it reports `photos` as one entry and maps it to a path
    // that deletes nothing. The photo keys come from the table instead, which
    // is the authority on them, and the folder listing is still run so an object
    // whose row never landed is collected too.
    const [coverPaths, orphanPaths, recordedPaths] = await Promise.all([
      listStorageFolder("event_images", `events/${event.id}`),
      listStorageFolder("event_images", eventPhotoFolder(event.id)),
      photoDao.listStoragePathsByEvent(supabase, event.id),
    ]);

    // `coverPaths` holds the `photos` directory entry itself, which is not an
    // object; dropping it keeps the delete call free of a key that can never
    // match. A Set because a recorded photo is also listed in the folder.
    pathsByBucket.event_images.push(
      ...new Set([...coverPaths.filter((path) => path !== eventPhotoFolder(event.id)), ...orphanPaths, ...recordedPaths]),
    );

    const courseId = await courseDao.findCourseIdByEventId(supabase, event.id);

    if (courseId) {
      const modules = await courseDao.findModulesByCourse(supabase, courseId);
      for (const mod of modules) {
        const lessons = await courseDao.findLessonsByModule(supabase, mod.id);
        for (const lesson of lessons) {
          const folder = `courses/${courseId}/modules/${mod.id}/lessons/${lesson.id}`;
          const [assetPaths, videoPaths] = await Promise.all([
            listStorageFolder("course_assets", folder),
            listStorageFolder("course_videos", folder),
          ]);
          pathsByBucket.course_assets.push(...assetPaths);
          pathsByBucket.course_videos.push(...videoPaths);
        }
      }
    }
  }

  return pathsByBucket;
}

export async function deleteEvent(supabase: DbClient, id: number, actor: EventActor): Promise<void> {
  const event = await eventDao.findById(supabase, id);

  const pathsByBucket = await collectStoragePaths(supabase, event);

  // Delete event row first (FK cascades handle payments, tickets)
  const removed = await eventDao.remove(supabase, id);

  if (!removed) {
    throw new EventServiceError(500, "Failed to delete event");
  }

  // Best-effort storage cleanup
  try {
    await Promise.all(
      Object.entries(pathsByBucket).map(([bucket, paths]) => deleteFromStorage(bucket as StorageBucket, paths)),
    );
  } catch {
    // Storage cleanup is best-effort
  }

  await requireAuditEvent(supabase, actor.id, "event.deleted", "event", id, {
    title: event?.title,
  });
}
