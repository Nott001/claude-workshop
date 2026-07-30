import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { getServiceClient } from "@/shared/db/client";
import { courseDao } from "@/shared/db/dao";

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const guard = await requireRole("speaker");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { eventId } = await params;
  const supabase = getServiceClient();
  const course = await courseDao.findCourseByEvent(supabase, Number(eventId));
  if (!course) {
    return NextResponse.json({ error: "No course for this event" }, { status: 404 });
  }

  return NextResponse.json(course);
}
