import { ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import type { UserRole } from "@/shared/types";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";

const updateSchema = z.object({
  role: z.enum([ROLES.SPEAKER, ROLES.FACILITATOR, ROLES.ADMIN]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { userId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.role === ROLES.ADMIN && !hasMinRole(guard.user.role, ROLES.SUPER_ADMIN)) {
    return NextResponse.json({ error: { message: "Only super admins can promote to admin" } }, { status: 403 });
  }

  const supabase = getServiceClient();

  const user = await userDao.updateRole(supabase, Number(userId), parsed.data.role as UserRole);

  if (!user) {
    return NextResponse.json({ error: { message: "Failed to update user role" } }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "organization.role_changed", "user", Number(userId), {
    new_role: parsed.data.role,
  });

  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { userId } = await params;
  const supabase = getServiceClient();

  if (guard.user.id === Number(userId)) {
    return NextResponse.json({ error: { message: "Cannot remove yourself" } }, { status: 400 });
  }

  const ok = await userDao.removeById(supabase, Number(userId));

  if (!ok) {
    return NextResponse.json({ error: { message: "Failed to remove user" } }, { status: 500 });
  }

  await logAuditEvent(supabase, guard.user.id, "organization.removed", "user", Number(userId));

  return NextResponse.json({ success: true });
}
