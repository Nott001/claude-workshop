import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, loadEventOr403 } from "@/modules/events/lib/event-service";
import { getStaffSurveyStatus } from "@/modules/surveys/lib/survey-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const event = await loadEventOr403(supabase, Number(id), user, "attendees");
    const status = await getStaffSurveyStatus(supabase, event);
    return NextResponse.json(status);
  } catch (err) {
    if (err instanceof EventServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
