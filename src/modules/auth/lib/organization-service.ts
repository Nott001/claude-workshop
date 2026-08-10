import type { DbClient } from "@/shared/db/dao/types";
import * as userDao from "@/shared/db/dao/user.dao";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { INVITED_ROLE_KEY } from "@/modules/auth/lib/invited-role";
import { findAuthAccountByEmail } from "@/modules/auth/lib/auth-account";
import { appBaseUrl } from "@/shared/lib/app-url";
import { getEmailService } from "@/shared/integrations/email";
import { memberInvitedTemplate } from "@/shared/integrations/email/templates";

export class OrganizationServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface InviteInput {
  email: string;
  full_name: string;
  role: string;
}

/**
 * Clears an auth account left behind by an invitation nobody accepted, so the
 * address can be invited again. Returns whether there was such an account.
 *
 * A signed-in account belongs to a person and refuses the invitation; an
 * account that never signed in holds nothing and is removed.
 */
export async function cleanupStaleAccounts(supabase: DbClient, email: string): Promise<boolean> {
  const account = await findAuthAccountByEmail(email);

  if (account?.accepted) {
    throw new OrganizationServiceError(409, "A user with this email already exists");
  }

  if (!account) return false;

  const { error: staleError } = await supabase.auth.admin.deleteUser(account.id);

  // Carrying on would ask Supabase for a link it cannot issue while the old
  // account stands, and report the refusal as "already exists" — a confident
  // wrong answer to an admin whose real problem is this delete.
  if (staleError) {
    throw new OrganizationServiceError(502, "Failed to clear the earlier invitation");
  }

  return true;
}

/**
 * Creates the auth account and returns the invitation token without sending
 * anything, which leaves the message itself to this project: the same
 * template, transport and mail server as the ticket emails, rather than a
 * template that can only be edited in a dashboard.
 */
export async function generateInviteLink(
  supabase: DbClient,
  input: InviteInput,
): Promise<{ userId: string; hashedToken: string }> {
  const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
    type: "invite",
    email: input.email,
  });

  if (linkError || !link?.user || !link.properties?.hashed_token) {
    const alreadyRegistered = /already|registered|exists/i.test(linkError?.message ?? "");
    throw new OrganizationServiceError(
      alreadyRegistered ? 409 : 502,
      alreadyRegistered ? "A user with this email already exists" : "Failed to create the invitation",
    );
  }

  const { error: roleError } = await supabase.auth.admin.updateUserById(link.user.id, {
    app_metadata: { [INVITED_ROLE_KEY]: input.role },
    // ensure-user reads the display name from here when the account first signs
    // in. Unlike the role, it is not an authorization input, so the account
    // holder rewriting it later is their own business.
    user_metadata: { full_name: input.full_name },
  });

  if (roleError) {
    await supabase.auth.admin.deleteUser(link.user.id);
    throw new OrganizationServiceError(500, "Failed to prepare the invitation");
  }

  return { userId: link.user.id, hashedToken: link.properties.hashed_token };
}

// Awaited rather than deferred: an admin needs to be told the invitation did
// not go out, which a response sent before the attempt cannot do. The
// half-created account would otherwise block a retry with "already registered"
// while its owner has never heard of it, so it is removed on failure.
export async function sendInviteEmail(
  supabase: DbClient,
  link: { userId: string; hashedToken: string },
  input: InviteInput,
): Promise<void> {
  const params = {
    name: input.full_name,
    role: input.role,
    // Fronted by our own domain rather than linking straight to Supabase: see
    // src/app/invite/page.tsx.
    acceptUrl: `${appBaseUrl()}/invite?token=${link.hashedToken}`,
  };

  const sent = await getEmailService().send({
    to: { email: input.email, name: input.full_name },
    subject: memberInvitedTemplate.subject,
    htmlContent: memberInvitedTemplate.buildHtml(params),
    textContent: memberInvitedTemplate.buildText(params),
  });

  if (!sent.success) {
    await supabase.auth.admin.deleteUser(link.userId);
    throw new OrganizationServiceError(502, "Could not send the invitation email");
  }
}

export async function inviteUser(
  supabase: DbClient,
  input: InviteInput,
  actorId: number,
): Promise<{ email: string; role: string }> {
  const existing = await userDao.findStaffByEmail(supabase, input.email);
  if (existing) {
    throw new OrganizationServiceError(409, "A user with this email already exists");
  }

  const resent = await cleanupStaleAccounts(supabase, input.email);
  const link = await generateInviteLink(supabase, input);
  await sendInviteEmail(supabase, link, input);

  await requireAuditEvent(supabase, actorId, "organization.invited", "user", null, {
    email: input.email,
    role: input.role,
    resent,
  });

  return { email: input.email, role: input.role };
}
