import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { moduleSchema } from "@/modules/courses/lib/schemas";
import { requireModuleAccess } from "@/modules/courses/lib/course-access";
import { deleteModuleWithStorage, setModuleLock, updateModule } from "@/modules/courses/lib/course-module-service";

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
      return toErrorResponse(err);
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
    return toErrorResponse(err);
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
    return toErrorResponse(err);
  }
}
