import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { requireRole } from "@/lib/auth/role-guard";
import { getServiceClient } from "@/lib/db";
import { userDao } from "@/lib/db/dao";
import type { UserRole } from "@/types";
import { logAuditEvent } from "@/modules/audit";

const updateSchema = z.object({
  role: z.enum(["attendee", "speaker", "facilitator"]),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { userId } = await params;
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  const user = await userDao.updateRole(supabase, Number(userId), parsed.data.role as UserRole);

  if (!user) {
    return NextResponse.json({ error: { message: "Failed to update user role" } }, { status: 500 });
  }

  const { userId: clerkId } = await auth();
  if (clerkId) {
    await logAuditEvent(supabase, clerkId, "organization.role_changed", "user", Number(userId), {
      new_role: parsed.data.role,
    });
  }

  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireRole("facilitator");
  if (!guard.allowed) {
    return NextResponse.json({ error: guard.error }, { status: 401 });
  }

  const { userId } = await params;
  const { userId: clerkId } = await auth();
  const supabase = getServiceClient();

  const currentUser = await userDao.findByAuthId(supabase, clerkId!);

  if (currentUser?.id === Number(userId)) {
    return NextResponse.json({ error: { message: "Cannot remove yourself" } }, { status: 400 });
  }

  const ok = await userDao.removeById(supabase, Number(userId));

  if (!ok) {
    return NextResponse.json({ error: { message: "Failed to remove user" } }, { status: 500 });
  }

  if (clerkId) {
    await logAuditEvent(supabase, clerkId, "organization.removed", "user", Number(userId));
  }

  return NextResponse.json({ success: true });
}
