import { NextResponse } from "next/server";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { deleteQuestion, getQuestion, QaServiceError } from "@/modules/courses/qa/lib/service";

function mapError(err: unknown): NextResponse {
  if (err instanceof QaServiceError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}

export async function GET(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  // Reading is open to any authenticated user, like the module listing; only
  // deletion is moderated. A panel fetches a question it just received a
  // realtime INSERT for, and those may belong to other attendees.
  try {
    const message = await getQuestion(supabase, Number(messageId));
    return NextResponse.json(message);
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const supabase = getServiceClient();

  const guard = await requireRole();
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  try {
    await deleteQuestion(supabase, Number(messageId), guard.user);
    return NextResponse.json({ success: true });
  } catch (err) {
    return mapError(err);
  }
}
