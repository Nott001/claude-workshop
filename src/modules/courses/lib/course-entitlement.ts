import { ROLES } from "@/shared/lib/roles";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { isEventFinished } from "@/shared/lib/date-utils";
import type { DbClient } from "@/shared/db/dao/types";
import type { UserRole } from "@/shared/types";
import { getSetting } from "@/shared/db/dao/system-setting.dao";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as ticketDao from "@/shared/db/dao/ticket.dao";
import {
  AFTER_EVENT_MODULES_SETTING_KEY,
  NO_RELEASES,
  afterEventModulesSchema,
  releaseFor,
  releasingEventIds,
  type AfterEventModules,
} from "@/modules/courses/lib/after-event-modules";

export interface CourseViewer {
  id: number;
  role: UserRole;
}

/**
 * How a viewer holds a course: `staff` reaches every one of them, `live` is a
 * ticket or a speaker assignment on the course's own event, null is neither.
 *
 * What a grant does *not* decide is which modules come with it — that is the
 * release window, in `after-event-modules.ts`. Holding the course and being
 * able to read all of it are different questions, and keeping them apart is
 * what lets one gate serve the live room and the self-paced page alike.
 */
export type CourseGrant = "staff" | "live" | null;

export async function readAfterEventModules(supabase: DbClient): Promise<AfterEventModules> {
  return getSetting(supabase, AFTER_EVENT_MODULES_SETTING_KEY, afterEventModulesSchema, NO_RELEASES);
}

/**
 * The one answer to "may this viewer open this course".
 *
 * Every surface that serves course content asks here — the room feed, the
 * by-event fetch and the storage route that hands over the materials — so none
 * of them can drift into its own idea of who is entitled, and material
 * released after an event is downloadable rather than a dead link.
 */
export async function resolveCourseGrant(supabase: DbClient, viewer: CourseViewer, courseId: number): Promise<CourseGrant> {
  if (hasMinRole(viewer.role, ROLES.FACILITATOR)) return "staff";
  return (await courseDao.userHasCourseAccess(supabase, viewer.id, courseId)) ? "live" : null;
}

/**
 * The courses whose held-back modules this viewer can now read: they hold a
 * live ticket to the event, and the event has finished.
 *
 * Narrowed to events that actually hold something back before any ticket is
 * read, and each course is trimmed to the modules that were released — so the
 * listing counts what the reader has been given, not what the course contains.
 */
export async function listReleasedCourses(supabase: DbClient, userId: number): Promise<courseDao.CourseSummary[]> {
  const map = await readAfterEventModules(supabase);
  const candidates = releasingEventIds(map);
  if (candidates.length === 0) return [];

  const windows = await ticketDao.listEventWindowsByUser(supabase, userId, candidates);
  const finished = windows.filter((event) => isEventFinished(event.event_date, event.end_time)).map((event) => event.id);
  if (finished.length === 0) return [];

  const courses = await courseDao.listCourseSummaries(supabase, { eventIds: finished });

  return courses.map((course) => {
    const released = new Set(releaseFor(map, course.EVENT?.id ?? 0));
    return { ...course, MODULE: course.MODULE.filter((mod) => released.has(mod.id)) };
  });
}
