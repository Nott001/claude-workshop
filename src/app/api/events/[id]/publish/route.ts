import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { EventServiceError, loadEventOr403, publishEvent } from "@/modules/events/lib/event-service";

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    await loadEventOr403(supabase, Number(id), user, "publish");
    await publishEvent(supabase, Number(id), { id: user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return mapError(err);
  }
}
