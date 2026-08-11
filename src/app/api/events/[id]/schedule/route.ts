import { NextResponse } from "next/server";
import { getServiceClient } from "@/shared/db/client";
import * as courseDao from "@/shared/db/dao/course.dao";

// Public by design: guests must see the schedule card with no session or
// ticket, so the payload is schedule facts only — never lesson content.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

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
