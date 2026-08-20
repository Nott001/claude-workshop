import type { DbClient } from "@/shared/db/dao/types";
import type { User } from "@/shared/types";
import * as userDao from "@/shared/db/dao/user.dao";
import { ROLES, type AssignableRole } from "@/shared/lib/roles";
import { canGrantRole } from "@/shared/lib/role-hierarchy";
import { requireAuditEvent } from "@/modules/audit/lib/log-audit-event";
import { INVITED_ROLE_KEY } from "@/modules/auth/lib/invited-role";
import { findAuthAccountByEmail } from "@/modules/auth/lib/auth-account";
import { appBaseUrl } from "@/shared/lib/app-url";
import { sendTemplatedEmail } from "@/shared/integrations/email/send-templated";
import { memberInvitedTemplate } from "@/shared/integrations/email/templates";
import { ServiceError } from "@/shared/lib/service-error";
import { deleteAccount } from "@/modules/user/lib/delete-account";

export class UserServiceError extends ServiceError {}

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
    throw new UserServiceError(409, "A user with this email already exists");
  }

  if (!account) return false;

  const { error: staleError } = await supabase.auth.admin.deleteUser(account.id);

  // Carrying on would ask Supabase for a link it cannot issue while the old
  // account stands, and report the refusal as "already exists" — a confident
  // wrong answer to an admin whose real problem is this delete.
  if (staleError) {
    throw new UserServiceError(502, "Failed to clear the earlier invitation");
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
    throw new UserServiceError(
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
    throw new UserServiceError(500, "Failed to prepare the invitation");
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

  const sent = await sendTemplatedEmail(memberInvitedTemplate, params, { email: input.email, name: input.full_name });

  if (!sent.success) {
    await supabase.auth.admin.deleteUser(link.userId);
    throw new UserServiceError(502, "Could not send the invitation email");
  }
}

/** The acting admin, as much of them as these rules need to judge a request. */
export type Actor = Pick<User, "id" | "role">;

/**
 * The rules that decide whether one member may act on another.
 *
 * Both callers need the same three, and they need the target's current role to
 * apply them — which is also the half of the audit trail the request does not
 * carry, so it is read once here and handed back rather than fetched twice.
 */
async function authorizeUserChange(supabase: DbClient, targetId: number, actor: Actor): Promise<Actor> {
  // Acting on yourself takes away the page you are standing on, and the account
  // that could undo it.
  if (actor.id === targetId) {
    throw new UserServiceError(400, "Cannot act on your own account");
  }

  // The role is the only field these rules judge, and the only one the audit row
  // needs back, so this reads two columns rather than the whole row.
  const target = await userDao.findRoleById(supabase, targetId);
  if (!target) {
    throw new UserServiceError(404, "User not found");
  }

  // A super admin outranks everyone who can reach these routes, including
  // another super admin. Leaving them editable would make the role assignable in
  // effect — demote the holder, and the seat is open to whoever asked.
  if (target.role === ROLES.SUPER_ADMIN) {
    throw new UserServiceError(403, "A super admin cannot be changed or removed");
  }

  return target;
}

export async function changeUserRole(
  supabase: DbClient,
  input: { targetId: number; role: AssignableRole },
  actor: Actor,
): Promise<Pick<User, "id" | "full_name" | "email" | "role">> {
  // Judged before the lookup: it depends only on who is asking and for what, so
  // a refusal here costs no round trip.
  if (!canGrantRole(actor.role, input.role)) {
    throw new UserServiceError(403, "You cannot grant a role you do not outrank");
  }

  const target = await authorizeUserChange(supabase, input.targetId, actor);

  const user = await userDao.updateRole(supabase, input.targetId, input.role);
  if (!user) {
    throw new UserServiceError(500, "Failed to update user role");
  }

  await requireAuditEvent(supabase, actor.id, "user.role_changed", "user", input.targetId, {
    previous_role: target.role,
    new_role: input.role,
  });

  return user;
}

export async function deleteUserAccount(supabase: DbClient, targetId: number, actor: Actor): Promise<void> {
  // Self, super admin and existence are judged by the shared rule.
  await authorizeUserChange(supabase, targetId, actor);

  // The purge needs the auth identity and the live address, and both must
  // be read before the tombstone replaces them.
  const target = await userDao.findById(supabase, targetId);
  if (!target) {
    throw new UserServiceError(404, "User not found");
  }

  // Irreversible, so stricter than a role change: only a role the actor
  // strictly outranks may be deleted.
  if (!canGrantRole(actor.role, target.role)) {
    throw new UserServiceError(403, "You can only delete a user in a role you outrank");
  }

  try {
    await deleteAccount({
      userId: target.id,
      authUserId: target.auth_user_id,
      email: target.email,
      role: target.role,
    });
  } catch (err) {
    // deleteAccount rethrows bare Errors; toErrorResponse only renders
    // ServiceErrors, so the message is carried into a 500 it will answer
    // with the flat `{ error }` shape instead of a server crash.
    throw new UserServiceError(500, err instanceof Error ? err.message : "Failed to delete the user's account");
  }

  await requireAuditEvent(supabase, actor.id, "user.deleted", "user", targetId, { role: target.role });
}

export async function inviteUser(
  supabase: DbClient,
  input: InviteInput,
  actorId: number,
): Promise<{ email: string; role: string }> {
  const existing = await userDao.findStaffByEmail(supabase, input.email);
  if (existing) {
    throw new UserServiceError(409, "A user with this email already exists");
  }

  const resent = await cleanupStaleAccounts(supabase, input.email);
  const link = await generateInviteLink(supabase, input);
  await sendInviteEmail(supabase, link, input);

  await requireAuditEvent(supabase, actorId, "user.invited", "user", null, {
    email: input.email,
    role: input.role,
    resent,
  });

  return { email: input.email, role: input.role };
}
