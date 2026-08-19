import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { loadEventOr403 } from "@/modules/events/lib/event-service";
import { getStaffSurveyStatus } from "@/modules/surveys/lib/survey-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  try {
    const event = await loadEventOr403(supabase, Number(id), guard.user, "survey");
    const status = await getStaffSurveyStatus(supabase, event);
    return NextResponse.json(status);
  } catch (err) {
    return toErrorResponse(err);
  }
}
