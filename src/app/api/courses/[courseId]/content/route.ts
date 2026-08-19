import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/lib/session";
import { isEventFinished, isEventStarted } from "@/shared/lib/date-utils";
import { getServiceClient } from "@/shared/db/client";
import { readAfterEventModules, resolveCourseGrant } from "@/modules/courses/lib/course-entitlement";
import { releaseFor, visibleModules } from "@/modules/courses/lib/after-event-modules";
import * as courseDao from "@/shared/db/dao/course.dao";
import { forbidden, unauthenticated } from "@/modules/auth/lib/guard-response";

/**
 * The self-paced surface's feed: a curriculum with no session around it.
 *
 * Separate from `/room` rather than a flag on it because the two need
 * different things. The room's payload carries the event window, the caller's
 * ticket and the speaker facts that drive a live session; none of that means
 * anything to material being read weeks after the event released it, and
 * shipping it anyway would put a whole event on the wire per page load. The
 * gate and the release rule are shared — the payloads are not.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = getServiceClient();

  const user = await getCurrentUser(supabase);
  if (!user) {
    return unauthenticated();
  }

  const course = await courseDao.findCourseWithDetails(supabase, Number(courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  const grant = await resolveCourseGrant(supabase, user, course.id);
  if (!grant) {
    return forbidden();
  }

  const map = await readAfterEventModules(supabase);
  const released = releaseFor(map, course.event_id);
  const event = course.EVENT;

  course.MODULE = visibleModules(course.MODULE, released, {
    started: isEventStarted(event?.event_date, event?.start_time),
    finished: !!event && isEventFinished(event.event_date, event.end_time),
    isStaff: grant === "staff",
  });

  return NextResponse.json({ course, grant, released_module_ids: released });
}
