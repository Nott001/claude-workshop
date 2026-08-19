import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { loadEventOr403 } from "@/modules/events/lib/event-service";
import { sendSurveyToAttendee } from "@/modules/surveys/lib/survey-service";

const NOT_SENT_MESSAGES: Record<string, string> = {
  not_enabled: "Enable surveys for this event before sending",
  not_finished: "The event has not ended yet",
  expired: "This survey is past its 14-day window and can no longer be sent",
  already_responded: "This attendee has already responded",
  no_ticket: "No active registration found",
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id: eventId, userId } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  let event;
  try {
    event = await loadEventOr403(supabase, Number(eventId), guard.user, "survey");
  } catch (err) {
    return toErrorResponse(err);
  }

  const result = await sendSurveyToAttendee(supabase, event, Number(userId));
  if (!result.ok) {
    return NextResponse.json({ error: NOT_SENT_MESSAGES[result.reason] }, { status: 400 });
  }
  return NextResponse.json(result);
}
