import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { userDao } from "@/shared/db/dao";
import { logAuditEvent } from "@/modules/audit";
import { hasMinRole } from "@/shared/lib/role-hierarchy";

const PAGE_SIZE = 10;

const inviteSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(["speaker", "facilitator", "admin"]),
});

export async function GET(req: Request) {
  const guard = await requireRole("admin");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const search = searchParams.get("search")?.trim() || "";

  const supabase = getServiceClient();

  const result = await userDao.listStaff(supabase, page, search, PAGE_SIZE);

  return NextResponse.json({
    users: result.data,
    total: result.total,
    page,
    pageSize: PAGE_SIZE,
  });
}

export async function POST(req: Request) {
  const guard = await requireRole("admin");
  if (!guard.allowed) {
    return guardFailure(guard);
  }

  const body = await req.json();
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.role === "admin" && !hasMinRole(guard.user.role, "super_admin")) {
    return NextResponse.json({ error: { message: "Only super admins can invite admins" } }, { status: 403 });
  }

  const supabase = getServiceClient();

  const existing = await userDao.findStaffByEmail(supabase, parsed.data.email);

  if (existing) {
    return NextResponse.json({ error: { message: "A user with this email already exists" } }, { status: 409 });
  }

  await logAuditEvent(supabase, guard.user.id, "organization.invited", "user", null, {
    email: parsed.data.email,
    role: parsed.data.role,
  });

  return NextResponse.json({ email: parsed.data.email, role: parsed.data.role }, { status: 201 });
}
