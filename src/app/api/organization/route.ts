import { ROLES, STAFF_ROLES } from "@/shared/lib/roles";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMinRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { INVITABLE_ROLES } from "@/modules/auth/lib/invited-role";
import { inviteUser, OrganizationServiceError } from "@/modules/auth/lib/organization-service";

const PAGE_SIZE = 10;

const inviteSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(INVITABLE_ROLES),
});

// Invitation failures are all answered with a nested { message }; keeping the
// shape the route has always used on the wire.
function mapError(err: unknown): NextResponse {
  if (err instanceof OrganizationServiceError) {
    return NextResponse.json({ error: { message: err.message } }, { status: err.status });
  }
  throw err;
}

export async function GET(req: Request) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const search = searchParams.get("search")?.trim() || "";

  // `role` reaches the DAO as an .eq value, so pinch it to the staff set rather
  // than let an arbitrary string ride the filter out to PostgREST.
  const role = searchParams.get("role") ?? undefined;
  if (role && !(STAFF_ROLES as readonly string[]).includes(role)) {
    return NextResponse.json({ error: { message: "Invalid role" } }, { status: 400 });
  }

  const supabase = getServiceClient();

  const result = await userDao.listStaff(supabase, { page, search, pageSize: PAGE_SIZE, role });

  return NextResponse.json({
    users: result.data,
    total: result.total,
    page,
    pageSize: PAGE_SIZE,
  });
}

export async function POST(req: Request) {
  const guard = await requireMinRole(ROLES.ADMIN);
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.role === ROLES.ADMIN && !hasMinRole(guard.user.role, ROLES.SUPER_ADMIN)) {
    return NextResponse.json({ error: { message: "Only super admins can invite admins" } }, { status: 403 });
  }

  const supabase = getServiceClient();

  try {
    const result = await inviteUser(supabase, parsed.data, guard.user.id);
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    return mapError(err);
  }
}
