import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as eventDao from "@/modules/events/db/event.dao";

export async function GET(_req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const course = await courseDao.findCourseWithDetails(supabase, Number(courseId));
  if (!course) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // The room admits ticket holders, assigned speakers and staff; the feed must
  // honour the same gate. A role check alone kept the room empty for the
  // attendees it let in.
  const entitled = hasMinRole(user.role, "facilitator") || (await courseDao.userHasCourseAccess(supabase, user.id, course.id));
  if (!entitled) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await eventDao.findByIdWithCourse(supabase, course.event_id);

  return NextResponse.json({ course, event });
}
