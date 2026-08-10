import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { moduleSchema } from "@/modules/courses/lib/schemas";
import { requireModuleAccess } from "@/modules/courses/lib/course-access";
import {
  CourseModuleServiceError,
  deleteModuleWithStorage,
  setModuleLock,
  updateModule,
} from "@/modules/courses/lib/course-module-service";

// The 400s are answered with a nested { message } and the 500s with a bare
// string; keeping both shapes so the wire contract does not change.
function mapError(err: unknown): NextResponse {
  if (err instanceof CourseModuleServiceError) {
    return NextResponse.json(err.status === 400 ? { error: { message: err.message } } : { error: err.message }, {
      status: err.status,
    });
  }
  throw err;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireModuleAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const body = await req.json();

  if (body.is_locked !== undefined) {
    const supabase = getServiceClient();
    try {
      const mod = await setModuleLock(supabase, Number(id), body.is_locked);
      return NextResponse.json(mod);
    } catch (err) {
      return mapError(err);
    }
  }

  const parsed = moduleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    const mod = await updateModule(supabase, Number(id), parsed.data, guard.user.id);
    return NextResponse.json(mod);
  } catch (err) {
    return mapError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireMinRole(ROLES.SPEAKER);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { id } = await params;
  const accessError = await requireModuleAccess(Number(id), guard.user.id, guard.user.role);
  if (accessError) return accessError;

  const supabase = getServiceClient();

  try {
    await deleteModuleWithStorage(supabase, Number(id), guard.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return mapError(err);
  }
}
