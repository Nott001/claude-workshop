import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { paymentInitSchema } from "@/modules/commerce/lib/payment-state";
import { getEventRegistrationState, registerForEvent } from "@/modules/events/lib/event-service";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  try {
    const state = await getEventRegistrationState(supabase, Number(id), guard.user);
    return NextResponse.json(state);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const parsed = paymentInitSchema.safeParse({ event_id: id });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await registerForEvent(supabase, Number(id), { id: guard.user.id, role: guard.user.role });
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
