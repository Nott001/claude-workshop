import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { loadEventOr403, publishEvent } from "@/modules/events/lib/event-service";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  try {
    await loadEventOr403(supabase, Number(id), guard.user, "publish");
    const result = await publishEvent(supabase, Number(id), { id: guard.user.id });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
