import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import { userDao } from "@/shared/db/dao";
import { logAuditEvent } from "@/modules/audit";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { INVITABLE_ROLES, INVITED_ROLE_KEY } from "@/modules/auth/lib/invited-role";
import { appBaseUrl } from "@/shared/lib/app-url";

const PAGE_SIZE = 10;

const inviteSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  role: z.enum(INVITABLE_ROLES),
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

  // Supabase both creates the account and sends the invitation, so it goes out
  // over the custom SMTP configured for this project rather than needing its
  // own template and transport.
  const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: parsed.data.full_name },
    redirectTo: `${appBaseUrl()}/api/auth/callback`,
  });

  if (inviteError || !invited?.user) {
    const alreadyRegistered = /already|registered|exists/i.test(inviteError?.message ?? "");
    return NextResponse.json(
      { error: { message: alreadyRegistered ? "A user with this email already exists" : "Failed to send the invitation" } },
      { status: alreadyRegistered ? 409 : 502 },
    );
  }

  // Written after the invite because the account does not exist until then. The
  // role is only read once the invitee signs in, which cannot happen before
  // they open the email, so the gap is not reachable in practice.
  const { error: roleError } = await supabase.auth.admin.updateUserById(invited.user.id, {
    app_metadata: { [INVITED_ROLE_KEY]: parsed.data.role },
  });

  if (roleError) {
    return NextResponse.json(
      { error: { message: "Invitation sent, but the role could not be attached. Re-send the invite to retry." } },
      { status: 500 },
    );
  }

  await logAuditEvent(supabase, guard.user.id, "organization.invited", "user", null, {
    email: parsed.data.email,
    role: parsed.data.role,
  });

  return NextResponse.json({ email: parsed.data.email, role: parsed.data.role }, { status: 201 });
}
