import { NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/modules/auth/lib/role-guard";
import { guardFailure } from "@/modules/auth/lib/guard-response";
import { getServiceClient } from "@/shared/db/client";
import * as userDao from "@/shared/db/dao/user.dao";
import { logAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { INVITABLE_ROLES, INVITED_ROLE_KEY } from "@/modules/auth/lib/invited-role";
import { findAuthAccountByEmail } from "@/modules/auth/lib/auth-account";
import { appBaseUrl } from "@/shared/lib/app-url";
import { getEmailService } from "@/shared/integrations/email";
import { memberInvitedTemplate } from "@/shared/integrations/email/templates";

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

  // An auth account outlives an invitation nobody accepted, and Supabase then
  // refuses to issue a second one for that address. Since such an account holds
  // nothing — never signed in, no USER row, no history — it is cleared out so
  // the invitation can be sent again, possibly for a different role.
  const account = await findAuthAccountByEmail(parsed.data.email);

  if (account?.accepted) {
    return NextResponse.json({ error: { message: "A user with this email already exists" } }, { status: 409 });
  }

  if (account) {
    const { error: staleError } = await supabase.auth.admin.deleteUser(account.id);

    // Carrying on would ask Supabase for a link it cannot issue while the old
    // account stands, and report the refusal as "already exists" — a confident
    // wrong answer to an admin whose real problem is this delete.
    if (staleError) {
      return NextResponse.json({ error: { message: "Failed to clear the earlier invitation" } }, { status: 502 });
    }
  }

  // `generateLink` creates the account and returns the invitation token without
  // sending anything, which leaves the message itself to this project: the same
  // template, transport and mail server as the ticket emails, rather than a
  // template that can only be edited in a dashboard.
  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: parsed.data.email,
  });

  if (linkError || !link?.user || !link.properties?.hashed_token) {
    const alreadyRegistered = /already|registered|exists/i.test(linkError?.message ?? "");
    return NextResponse.json(
      { error: { message: alreadyRegistered ? "A user with this email already exists" : "Failed to create the invitation" } },
      { status: alreadyRegistered ? 409 : 502 },
    );
  }

  const { error: roleError } = await supabase.auth.admin.updateUserById(link.user.id, {
    app_metadata: { [INVITED_ROLE_KEY]: parsed.data.role },
    // ensure-user reads the display name from here when the account first signs
    // in. Unlike the role, it is not an authorization input, so the account
    // holder rewriting it later is their own business.
    user_metadata: { full_name: parsed.data.full_name },
  });

  if (roleError) {
    await supabase.auth.admin.deleteUser(link.user.id);
    return NextResponse.json({ error: { message: "Failed to prepare the invitation" } }, { status: 500 });
  }

  const template = memberInvitedTemplate;
  const params = {
    name: parsed.data.full_name,
    role: parsed.data.role,
    // Fronted by our own domain rather than linking straight to Supabase: see
    // src/app/invite/page.tsx.
    acceptUrl: `${appBaseUrl()}/invite?token=${link.properties.hashed_token}`,
  };

  // Awaited rather than deferred: an admin needs to be told the invitation did
  // not go out, which a response sent before the attempt cannot do.
  const sent = await getEmailService().send({
    to: { email: parsed.data.email, name: parsed.data.full_name },
    subject: template.subject,
    htmlContent: template.buildHtml(params),
    textContent: template.buildText(params),
  });

  if (!sent.success) {
    // The half-created account would otherwise block a retry with "already
    // registered" while its owner has never heard of it.
    await supabase.auth.admin.deleteUser(link.user.id);
    return NextResponse.json({ error: { message: "Could not send the invitation email" } }, { status: 502 });
  }

  await logAuditEvent(supabase, guard.user.id, "organization.invited", "user", null, {
    email: parsed.data.email,
    role: parsed.data.role,
    resent: Boolean(account),
  });

  return NextResponse.json({ email: parsed.data.email, role: parsed.data.role }, { status: 201 });
}
