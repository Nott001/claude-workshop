import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, loadEventOr403 } from "@/modules/events/lib/event-service";
import { sendEventSurvey } from "@/modules/surveys/lib/survey-service";

const NOT_SENT_MESSAGES: Record<string, string> = {
  not_enabled: "Enable surveys for this event before sending",
  not_finished: "The event has not ended yet",
  no_recipients: "There are no registered attendees to survey",
  expired: "This survey is past its 14-day window and can no longer be sent",
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const event = await loadEventOr403(supabase, Number(id), user, "edit");
    const result = await sendEventSurvey(supabase, event);
    if (!result.ok) {
      return NextResponse.json({ error: NOT_SENT_MESSAGES[result.reason] }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EventServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
