import { ROLES } from "@/shared/lib/roles";
import type { DbClient } from "@/shared/db/dao/types";
import type { UserRole } from "@/shared/types";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "@/shared/lib/rate-limit";
import { CHAT_CLAIMED_MESSAGE, CHAT_ENDED_MESSAGE, CHAT_UNCLAIMED_MESSAGE } from "./support-notices";
import { ServiceError } from "@/shared/lib/service-error";

export class SupportServiceError extends ServiceError {}

/**
 * Whether the caller may send another message inside the window. The threshold
 * lives here so the rule and its constants stay together; the route decides the
 * 429.
 */
export async function rateLimitCheck(supabase: DbClient, userId: number): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const count = await chatDao.countRecentByUser(supabase, userId, "general", windowStart);
  return count >= RATE_LIMIT_MAX;
}

export interface OpenSessionInput {
  userId: number;
  role: UserRole;
  /** A staff member replying into somebody else's case. */
  recipientUserId?: number;
}

/**
 * The session a message is attached to. A staff reply goes into the asker's
 * active case and only its assigned handler may send it — otherwise two staff
 * members talk at once. Anything else reuses the caller's own active session or
 * opens one.
 */
export async function openOrReuseSession(
  supabase: DbClient,
  { userId, role, recipientUserId }: OpenSessionInput,
): Promise<NonNullable<Awaited<ReturnType<typeof chatDao.findActiveSession>>>> {
  const isStaff = hasMinRole(role, ROLES.ADMIN);

  if (isStaff && recipientUserId) {
    const active = await chatDao.findActiveSession(supabase, recipientUserId, "general");
    if (!active) {
      throw new SupportServiceError(404, "No active case for this user");
    }
    if (active.assigned_to === null) {
      throw new SupportServiceError(409, "Claim this case before replying");
    }
    if (active.assigned_to !== userId) {
      throw new SupportServiceError(403, "This case is being handled by another staff member");
    }
    return active;
  }

  const sessionUserId = isStaff && recipientUserId ? recipientUserId : userId;
  const existing = await chatDao.findActiveSession(supabase, sessionUserId, "general");
  if (existing) return existing;

  const created = await chatDao.createSession(supabase, sessionUserId, "general");
  // createSession returns null on failure; asserting non-null turned an insert
  // error into a TypeError and a 500 with no usable message.
  if (!created) {
    throw new SupportServiceError(500, "Failed to start a support session");
  }
  // A fresh case number means the previous ended session is retired with its
  // transcript, instead of accumulating quietly forever.
  await chatDao.deleteSessionsExcept(supabase, sessionUserId, "general", created.id);
  return created;
}

/**
 * A lifecycle notice lands on the attendee's thread as a row from the acting
 * staff member, so existing read and realtime grants reach both parties.
 */
async function recordNotice(
  supabase: DbClient,
  sessionId: number,
  actorId: number,
  recipientUserId: number,
  message: string,
): Promise<void> {
  await chatDao.sendMessage(supabase, {
    support_type: "general",
    user_id: actorId,
    message,
    session_id: sessionId,
    recipient_user_id: recipientUserId,
  });
}

export async function sendSupportMessage(
  supabase: DbClient,
  input: {
    message: string;
    sessionId: number;
    userId: number;
    role: UserRole;
    recipientUserId?: number;
  },
): Promise<NonNullable<Awaited<ReturnType<typeof chatDao.sendMessage>>>> {
  const isStaff = hasMinRole(input.role, ROLES.ADMIN);
  const message = await chatDao.sendMessage(supabase, {
    support_type: "general",
    user_id: input.userId,
    message: input.message,
    session_id: input.sessionId,
    recipient_user_id: isStaff && input.recipientUserId ? input.recipientUserId : undefined,
  });

  if (!message) {
    throw new SupportServiceError(500, "Failed to send message");
  }
  return message;
}

function assertClaimable(targetUserId: number, actorId: number): void {
  if (targetUserId === actorId) {
    throw new SupportServiceError(400, "Not supported for this session");
  }
}

export async function claimCase(
  supabase: DbClient,
  targetUserId: number,
  actorId: number,
): Promise<NonNullable<Awaited<ReturnType<typeof chatDao.claimSession>>>> {
  assertClaimable(targetUserId, actorId);

  const session = await chatDao.claimSession(supabase, targetUserId, "general", actorId);
  if (!session) {
    throw new SupportServiceError(409, "This case is already claimed or has no active session");
  }
  await recordNotice(supabase, session.id, actorId, targetUserId, CHAT_CLAIMED_MESSAGE);
  return session;
}

export async function releaseCase(
  supabase: DbClient,
  targetUserId: number,
  actorId: number,
): Promise<NonNullable<Awaited<ReturnType<typeof chatDao.relinquishSession>>>> {
  assertClaimable(targetUserId, actorId);

  const session = await chatDao.relinquishSession(supabase, targetUserId, "general", actorId);
  if (!session) {
    throw new SupportServiceError(409, "You are not the assigned handler of this case");
  }
  await recordNotice(supabase, session.id, actorId, targetUserId, CHAT_UNCLAIMED_MESSAGE);
  return session;
}

/**
 * Ends the target's session. Ending somebody else's case is reserved for its
 * handler; an unclaimed case can be closed by any staff member so the queue
 * stays cleanable.
 */
export async function endCase(
  supabase: DbClient,
  targetUserId: number,
  actor: { id: number; role: UserRole },
): Promise<Awaited<ReturnType<typeof chatDao.endSession>>> {
  const isOwn = targetUserId === actor.id;

  let session: Awaited<ReturnType<typeof chatDao.endSession>>;
  if (!isOwn) {
    const active = await chatDao.findActiveSession(supabase, targetUserId, "general");
    if (!active) {
      throw new SupportServiceError(404, "No active case for this user");
    }
    if (active.assigned_to !== null && active.assigned_to !== actor.id) {
      throw new SupportServiceError(403, "Only the assigned handler can end this case");
    }
    session = await chatDao.endSession(supabase, targetUserId, "general", { ownerId: active.assigned_to });
  } else {
    session = await chatDao.endSession(supabase, targetUserId, "general");
  }

  // Tell the attendee in the thread why the chat stopped; the case is kept
  // until their next message opens a fresh one.
  if (session) {
    await recordNotice(supabase, session.id, actor.id, targetUserId, CHAT_ENDED_MESSAGE);
  }
  return session;
}
