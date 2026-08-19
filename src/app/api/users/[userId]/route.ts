import { ASSIGNABLE_ROLES, ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { toErrorResponse } from "@/shared/lib/error-response";
import { changeUserRole, deleteUserAccount } from "@/modules/user/lib/user-service";

const updateSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES),
});

/**
 * The path segment is caller-supplied text. `Number("abc")` is NaN, which
 * PostgREST answers with an error rather than "no such row", so it is refused
 * here instead of reaching the database as a malformed filter.
 */
function parseUserId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { userId } = await params;
  const targetId = parseUserId(userId);
  if (targetId === null) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    const user = await changeUserRole(supabase, { targetId, role: parsed.data.role }, guard.user);
    return NextResponse.json(user);
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { userId } = await params;
  const targetId = parseUserId(userId);
  if (targetId === null) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const supabase = getServiceClient();

  try {
    await deleteUserAccount(supabase, targetId, guard.user);
    return NextResponse.json({ success: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}
