import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { resolveCourseGrant } from "@/modules/courses/lib/course-entitlement";
import * as courseDao from "@/shared/db/dao/course.dao";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const course = await courseDao.findCourseByEvent(supabase, Number(eventId));
  if (!course) {
    return NextResponse.json({ error: "No course for this event" }, { status: 404 });
  }

  // The room admits ticket holders, assigned speakers and staff; the course
  // feed must honour the same gate. A role check alone kept the room empty for
  // the attendees it let in.
  if (!(await resolveCourseGrant(supabase, user, course.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(course);
}
