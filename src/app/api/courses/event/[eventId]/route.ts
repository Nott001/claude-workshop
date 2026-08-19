import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { forbidden, guardFailure } from "@/modules/auth/lib/guard-response";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { getServiceClient } from "@/shared/db/client";
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
  const entitled =
    hasMinRole(guard.user.role, ROLES.FACILITATOR) || (await courseDao.userHasCourseAccess(supabase, guard.user.id, course.id));
  if (!entitled) {
    return forbidden();
  }

  return NextResponse.json(course);
}
