import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { paymentInitSchema } from "@/modules/commerce/lib/payment-state";
import { EventServiceError, getEventRegistrationState, registerForEvent } from "@/modules/events/lib/event-service";
import { badRequest } from "@/shared/lib/api-response";

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  try {
    const state = await getEventRegistrationState(supabase, Number(id), {
      id: user.id,
      role: user.role,
      full_name: user.full_name,
      email: user.email,
    });
    return NextResponse.json(state);
  } catch (err) {
    return mapError(err);
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const parsed = paymentInitSchema.safeParse({ event_id: id });
  if (!parsed.success) {
    return badRequest(parsed.error);
  }

  try {
    const result = await registerForEvent(supabase, Number(id), { id: user.id, role: user.role });
    return NextResponse.json(result);
  } catch (err) {
    return mapError(err);
  }
}
