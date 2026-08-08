import { ROLES } from "@/shared/lib/roles";
import type { DbClient } from "@/shared/db/dao/types";
import type { UserRole } from "@/shared/types";
import * as chatDao from "@/shared/db/dao/chat.dao";
import { hasMinRole } from "@/shared/lib/role-hierarchy";
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX } from "@/modules/chat/lib/rate-limit";

export class SupportServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export type SupportType = "general" | "event";

/**
 * Whether the caller may send another message inside the window. The threshold
 * lives here so the rule and its constants stay together; the route decides the
 * 429.
 */
export async function rateLimitCheck(supabase: DbClient, userId: number, supportType: SupportType): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const count = await chatDao.countRecentByUser(supabase, userId, supportType, windowStart);
  return count >= RATE_LIMIT_MAX;
}

export interface OpenSessionInput {
  userId: number;
  role: UserRole;
  supportType: SupportType;
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
  { userId, role, supportType, recipientUserId }: OpenSessionInput,
): Promise<NonNullable<Awaited<ReturnType<typeof chatDao.findActiveSession>>>> {
  const isStaff = hasMinRole(role, supportType === "general" ? ROLES.ADMIN : ROLES.FACILITATOR);

  if (supportType === "general" && isStaff && recipientUserId) {
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
  const existing = await chatDao.findActiveSession(supabase, sessionUserId, supportType);
  if (existing) return existing;

  const created = await chatDao.createSession(supabase, sessionUserId, supportType);
  // createSession returns null on failure; asserting non-null turned an insert
  // error into a TypeError and a 500 with no usable message.
  if (!created) {
    throw new SupportServiceError(500, "Failed to start a support session");
  }
  return created;
}

export async function sendSupportMessage(
  supabase: DbClient,
  input: {
    message: string;
    sessionId: number;
    userId: number;
    role: UserRole;
    supportType: SupportType;
    recipientUserId?: number;
  },
): Promise<NonNullable<Awaited<ReturnType<typeof chatDao.sendMessage>>>> {
  const isStaff = hasMinRole(input.role, input.supportType === "general" ? ROLES.ADMIN : ROLES.FACILITATOR);
  const message = await chatDao.sendMessage(supabase, {
    support_type: input.supportType,
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

// Case ownership is a general-support concept for now; event support keeps its
// current free-for-all until it gets the same overhaul.
function assertClaimable(supportType: SupportType, targetUserId: number, actorId: number): void {
  if (supportType !== "general" || targetUserId === actorId) {
    throw new SupportServiceError(400, "Not supported for this session");
  }
}

export async function claimCase(
  supabase: DbClient,
  targetUserId: number,
  supportType: SupportType,
  actorId: number,
): Promise<NonNullable<Awaited<ReturnType<typeof chatDao.claimSession>>>> {
  assertClaimable(supportType, targetUserId, actorId);

  const session = await chatDao.claimSession(supabase, targetUserId, "general", actorId);
  if (!session) {
    throw new SupportServiceError(409, "This case is already claimed or has no active session");
  }
  return session;
}

export async function releaseCase(
  supabase: DbClient,
  targetUserId: number,
  supportType: SupportType,
  actorId: number,
): Promise<NonNullable<Awaited<ReturnType<typeof chatDao.relinquishSession>>>> {
  assertClaimable(supportType, targetUserId, actorId);

  const session = await chatDao.relinquishSession(supabase, targetUserId, "general", actorId);
  if (!session) {
    throw new SupportServiceError(409, "You are not the assigned handler of this case");
  }
  return session;
}

/**
 * Ends the target's session. Ending somebody else's general case is reserved
 * for its handler; an unclaimed case can be closed by any staff member so the
 * queue stays cleanable. Event cases stay free-for-all.
 */
export async function endCase(
  supabase: DbClient,
  targetUserId: number,
  supportType: SupportType,
  actor: { id: number; role: UserRole },
): Promise<Awaited<ReturnType<typeof chatDao.endSession>>> {
  const isOwn = targetUserId === actor.id;

  if (supportType === "general" && !isOwn) {
    const active = await chatDao.findActiveSession(supabase, targetUserId, "general");
    if (!active) {
      throw new SupportServiceError(404, "No active case for this user");
    }
    if (active.assigned_to !== null && active.assigned_to !== actor.id) {
      throw new SupportServiceError(403, "Only the assigned handler can end this case");
    }
    return chatDao.endSession(supabase, targetUserId, "general", undefined, { ownerId: active.assigned_to });
  }

  return chatDao.endSession(supabase, targetUserId, supportType);
}
