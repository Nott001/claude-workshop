import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";
import * as eventDao from "@/modules/events/db/event.dao";

// Public by design: guests must see the schedule card with no session or
// ticket, so the payload is schedule facts only — never lesson content. A draft
// (or unknown) event answers an empty list, not a 404, because the middleware
// lets every guest through and only the event detail page decides whether the
// card exists.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  if (!(await eventDao.isPublished(supabase, Number(id)))) {
    return NextResponse.json({ modules: [] });
  }

  const modules = await courseDao.findCourseScheduleByEvent(supabase, Number(id));

  return NextResponse.json({
    modules: (modules ?? []).map((m) => ({
      id: m.id,
      module_name: m.module_name,
      start_time: m.start_time,
      end_time: m.end_time,
      speaker: m.SPEAKER_PROFILE?.USER?.full_name ?? null,
    })),
  });
}
