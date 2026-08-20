import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { forbidden, guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { resolveCourseGrant } from "@/modules/courses/lib/course-entitlement";
import * as courseDao from "@/shared/db/dao/course.dao";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const course = await courseDao.findCourseByEvent(supabase, Number(eventId));
  if (!course) {
    return NextResponse.json({ error: "No course for this event" }, { status: 404 });
  }

  // The room admits ticket holders, assigned speakers and staff; the course
  // feed must honour the same gate. A role check alone kept the room empty for
  // the attendees it let in.
  if (!(await resolveCourseGrant(supabase, guard.user, course.id))) {
    return forbidden();
  }

  return NextResponse.json(course);
}
