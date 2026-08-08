import { NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/lib/session";
import { getServiceClient } from "@/shared/db/client";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import {
  clearEventHighlight,
  EventServiceError,
  getEventHighlight,
  setEventHighlight,
} from "@/modules/events/lib/event-service";

function mapError(err: unknown): NextResponse {
  if (err instanceof EventServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  try {
    const state = await getEventHighlight(supabase, Number(id));
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinRole(user.role, "speaker")) {
    return NextResponse.json({ error: "Only speakers and facilitators can update the live highlight" }, { status: 403 });
  }

  const body = await req.json();
  const lessonId = body.lesson_id ?? null;

  try {
    const state = await setEventHighlight(supabase, Number(id), lessonId, { id: user.id });
    return NextResponse.json(state);
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();

  const user = await requireAuth(supabase);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasMinRole(user.role, "speaker")) {
    return NextResponse.json({ error: "Only speakers and facilitators can clear the live highlight" }, { status: 403 });
  }

  try {
    const result = await clearEventHighlight(supabase, Number(id), { id: user.id });
    return NextResponse.json(result);
  } catch (err) {
    return mapError(err);
  }
}
