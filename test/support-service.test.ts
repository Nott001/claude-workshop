import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import {
  claimCase,
  endCase,
  openOrReuseSession,
  rateLimitCheck,
  releaseCase,
  sendSupportMessage,
  SupportServiceError,
} from "@/modules/chat/lib/support-service";

const { chatDao } = vi.hoisted(() => ({
  chatDao: {
    countRecentByUser: vi.fn(),
    findActiveSession: vi.fn(),
    createSession: vi.fn(),
    sendMessage: vi.fn(),
    claimSession: vi.fn(),
    relinquishSession: vi.fn(),
    endSession: vi.fn(),
    deleteSessionsExcept: vi.fn(),
  },
}));

vi.mock("@/shared/db/dao/chat.dao", () => chatDao);

const supabase = {} as unknown as DbClient;

beforeEach(() => {
  vi.clearAllMocks();
  chatDao.countRecentByUser.mockResolvedValue(0);
  chatDao.findActiveSession.mockResolvedValue(null);
  chatDao.createSession.mockResolvedValue({ id: 31, status: "active" });
  chatDao.sendMessage.mockResolvedValue({ id: 100, message: "help" });
  chatDao.claimSession.mockResolvedValue({ id: 50, status: "active" });
  chatDao.relinquishSession.mockResolvedValue({ id: 50, status: "active" });
  chatDao.endSession.mockResolvedValue({ id: 50, status: "ended_by_facilitator" });
  chatDao.deleteSessionsExcept.mockResolvedValue(true);
});

describe("rateLimitCheck", () => {
  it("allows a caller under the threshold", async () => {
    expect(await rateLimitCheck(supabase, 5)).toBe(false);
  });

  it("refuses a caller at the limit", async () => {
    chatDao.countRecentByUser.mockResolvedValue(5);

    expect(await rateLimitCheck(supabase, 5)).toBe(true);
  });

  it("counts the caller's messages inside the window on the general thread", async () => {
    await rateLimitCheck(supabase, 5);

    expect(chatDao.countRecentByUser).toHaveBeenCalledWith({}, 5, "general", expect.any(String));
  });
});

describe("openOrReuseSession", () => {
  it("opens a session the caller has none open", async () => {
    const session = await openOrReuseSession(supabase, { userId: 5, role: ROLES.ATTENDEE });

    expect(session).toEqual({ id: 31, status: "active" });
    expect(chatDao.createSession).toHaveBeenCalledWith({}, 5, "general");
  });

  it("retires the previous ended session when a fresh one opens", async () => {
    chatDao.createSession.mockResolvedValue({ id: 31, status: "active" });

    await openOrReuseSession(supabase, { userId: 5, role: ROLES.ATTENDEE });

    expect(chatDao.deleteSessionsExcept).toHaveBeenCalledWith({}, 5, "general", 31);
  });

  it("reuses an open session without touching the queue of endings", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 12, status: "active" });

    await openOrReuseSession(supabase, { userId: 5, role: ROLES.ATTENDEE });

    expect(chatDao.createSession).not.toHaveBeenCalled();
    expect(chatDao.deleteSessionsExcept).not.toHaveBeenCalled();
  });

  it("surfaces a session that failed to open as a handled error", async () => {
    chatDao.createSession.mockResolvedValue(null);

    await expect(openOrReuseSession(supabase, { userId: 5, role: ROLES.ATTENDEE })).rejects.toMatchObject({ status: 500 });
  });

  it("replies into the asker's case only when it is claimed by this staff member", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 31, assigned_to: 1 });

    const session = await openOrReuseSession(supabase, {
      userId: 1,
      role: ROLES.ADMIN,
      recipientUserId: 5,
    });

    expect(session.id).toBe(31);
    expect(chatDao.createSession).not.toHaveBeenCalled();
  });

  it("refuses a staff reply to a case nobody claimed", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 31, assigned_to: null });

    await expect(openOrReuseSession(supabase, { userId: 1, role: ROLES.ADMIN, recipientUserId: 5 })).rejects.toMatchObject({
      status: 409,
    });
  });

  it("refuses a staff reply to a case another handler owns", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 31, assigned_to: 2 });

    await expect(openOrReuseSession(supabase, { userId: 1, role: ROLES.ADMIN, recipientUserId: 5 })).rejects.toMatchObject({
      status: 403,
    });
  });

  it("reports a reply aimed at a user with no active case", async () => {
    await expect(openOrReuseSession(supabase, { userId: 1, role: ROLES.ADMIN, recipientUserId: 5 })).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("sendSupportMessage", () => {
  it("sends under the caller's own session", async () => {
    const message = await sendSupportMessage(supabase, {
      message: "help",
      sessionId: 31,
      userId: 5,
      role: ROLES.ATTENDEE,
    });

    expect(message).toEqual({ id: 100, message: "help" });
    expect(chatDao.sendMessage).toHaveBeenCalledWith(
      {},
      { support_type: "general", user_id: 5, message: "help", session_id: 31, recipient_user_id: undefined },
    );
  });

  it("names the asker as recipient for a staff reply", async () => {
    await sendSupportMessage(supabase, {
      message: "hello",
      sessionId: 31,
      userId: 1,
      role: ROLES.ADMIN,
      recipientUserId: 5,
    });

    expect(chatDao.sendMessage).toHaveBeenCalledWith({}, expect.objectContaining({ recipient_user_id: 5 }));
  });

  it("reports a message that could not be stored", async () => {
    chatDao.sendMessage.mockResolvedValue(null);

    await expect(
      sendSupportMessage(supabase, { message: "help", sessionId: 31, userId: 5, role: ROLES.ATTENDEE }),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe("claimCase", () => {
  it("claims an unclaimed case and tells the asker", async () => {
    const session = await claimCase(supabase, 99, 1);

    expect(session).toEqual({ id: 50, status: "active" });
    expect(chatDao.claimSession).toHaveBeenCalledWith({}, 99, "general", 1);
    expect(chatDao.sendMessage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ session_id: 50, user_id: 1, recipient_user_id: 99 }),
    );
    expect(String(chatDao.sendMessage.mock.calls[0][1].message)).toContain("[Case assigned]");
  });

  it("refuses to claim your own session", async () => {
    await expect(claimCase(supabase, 1, 1)).rejects.toMatchObject({ status: 400 });
  });

  it("reports a case somebody else already claimed", async () => {
    chatDao.claimSession.mockResolvedValue(null);

    await expect(claimCase(supabase, 99, 1)).rejects.toMatchObject({ status: 409 });
  });
});

describe("releaseCase", () => {
  it("relinquishes a case the caller owns and tells the asker", async () => {
    const session = await releaseCase(supabase, 99, 1);

    expect(session).toEqual({ id: 50, status: "active" });
    expect(chatDao.relinquishSession).toHaveBeenCalledWith({}, 99, "general", 1);
    expect(chatDao.sendMessage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ session_id: 50, user_id: 1, recipient_user_id: 99 }),
    );
    expect(String(chatDao.sendMessage.mock.calls[0][1].message)).toContain("[Case unassigned]");
  });

  it("refuses to relinquish a case the caller does not own", async () => {
    chatDao.relinquishSession.mockResolvedValue(null);

    await expect(releaseCase(supabase, 99, 1)).rejects.toMatchObject({ status: 409 });
  });
});

describe("endCase", () => {
  it("ends your own session", async () => {
    const session = await endCase(supabase, 5, { id: 5, role: ROLES.ATTENDEE });

    expect(session).toMatchObject({ id: 50 });
    expect(chatDao.endSession).toHaveBeenCalledWith({}, 5, "general");
  });

  it("lets an admin close an unclaimed case for someone else", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 7, assigned_to: null });

    await endCase(supabase, 99, { id: 1, role: ROLES.ADMIN });

    expect(chatDao.endSession).toHaveBeenCalledWith({}, 99, "general", { ownerId: null });
  });

  it("lets the assigned handler close the case", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 7, assigned_to: 1 });

    await endCase(supabase, 99, { id: 1, role: ROLES.ADMIN });

    expect(chatDao.endSession).toHaveBeenCalledWith({}, 99, "general", { ownerId: 1 });
  });

  it("writes the closing notice into the ended thread", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 7, assigned_to: 1 });

    await endCase(supabase, 99, { id: 1, role: ROLES.ADMIN });

    expect(chatDao.sendMessage).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ session_id: 50, user_id: 1, recipient_user_id: 99 }),
    );
    expect(String(chatDao.sendMessage.mock.calls[0][1].message)).toContain("[Chat ended]");
  });

  it("stops an admin ending a case that belongs to another handler", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 7, assigned_to: 2 });

    await expect(endCase(supabase, 99, { id: 1, role: ROLES.ADMIN })).rejects.toMatchObject({ status: 403 });
  });

  it("reports when the target has no active case", async () => {
    await expect(endCase(supabase, 99, { id: 1, role: ROLES.ADMIN })).rejects.toMatchObject({ status: 404 });
  });
});

describe("SupportServiceError", () => {
  it("carries the status a route maps to NextResponse", () => {
    const err = new SupportServiceError(429, "Too many messages");

    expect(err.status).toBe(429);
    expect(err.message).toBe("Too many messages");
  });
});
