import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { eventPartialSchema } from "@/modules/events/lib/schemas";
import { deleteEvent, EventServiceError, getEvent, updateEvent } from "@/modules/events/lib/event-service";

// The 404s are answered with a bare string and the 400/500s with a nested
// { message }; keeping both shapes so the wire contract does not change.
function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    if (err.status === 404) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: { message: err.message } }, { status: err.status });
  }
  throw err;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  const userRole = user?.role ?? null;

  try {
    const event = await getEvent(supabase, Number(id), { id: user?.id ?? null, role: userRole });
    return NextResponse.json(event);
  } catch (err) {
    return mapError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = eventPartialSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    const event = await updateEvent(supabase, Number(id), parsed.data, { id: guard.user.id });
    return NextResponse.json(event);
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const supabase = getServiceClient();

  try {
    const result = await deleteEvent(supabase, Number(id), { id: guard.user.id });
    return NextResponse.json(result);
  } catch (err) {
    return mapError(err);
  }
}
