import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, publishEvent } from "@/modules/events/lib/event-service";

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const supabase = getServiceClient();

  try {
    const result = await publishEvent(supabase, Number(id), { id: guard.user.id });
    return NextResponse.json(result);
  } catch (err) {
    return mapError(err);
  }
}
