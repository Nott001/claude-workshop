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
  chatDao.endSession.mockResolvedValue({ id: 50, status: "ended" });
});

describe("rateLimitCheck", () => {
  it("allows a caller under the threshold", async () => {
    expect(await rateLimitCheck(supabase, 5, "general")).toBe(false);
  });

  it("refuses a caller at the limit", async () => {
    chatDao.countRecentByUser.mockResolvedValue(5);

    expect(await rateLimitCheck(supabase, 5, "general")).toBe(true);
  });
});

describe("openOrReuseSession", () => {
  it("opens a session the caller has none open", async () => {
    const session = await openOrReuseSession(supabase, { userId: 5, role: ROLES.ATTENDEE, supportType: "general" });

    expect(session).toEqual({ id: 31, status: "active" });
    expect(chatDao.createSession).toHaveBeenCalledWith({}, 5, "general");
  });

  it("reuses the caller's open session instead of opening another", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 12, status: "active" });

    const session = await openOrReuseSession(supabase, { userId: 5, role: ROLES.ATTENDEE, supportType: "general" });

    expect(session.id).toBe(12);
    expect(chatDao.createSession).not.toHaveBeenCalled();
  });

  it("surfaces a session that failed to open as a handled error", async () => {
    chatDao.createSession.mockResolvedValue(null);

    await expect(
      openOrReuseSession(supabase, { userId: 5, role: ROLES.ATTENDEE, supportType: "general" }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it("replies into the asker's case only when it is claimed by this staff member", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 31, assigned_to: 1 });

    const session = await openOrReuseSession(supabase, {
      userId: 1,
      role: ROLES.ADMIN,
      supportType: "general",
      recipientUserId: 5,
    });

    expect(session.id).toBe(31);
    expect(chatDao.createSession).not.toHaveBeenCalled();
  });

  it("refuses a staff reply to a case nobody claimed", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 31, assigned_to: null });

    await expect(
      openOrReuseSession(supabase, { userId: 1, role: ROLES.ADMIN, supportType: "general", recipientUserId: 5 }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("refuses a staff reply to a case another handler owns", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 31, assigned_to: 2 });

    await expect(
      openOrReuseSession(supabase, { userId: 1, role: ROLES.ADMIN, supportType: "general", recipientUserId: 5 }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("reports a reply aimed at a user with no active case", async () => {
    await expect(
      openOrReuseSession(supabase, { userId: 1, role: ROLES.ADMIN, supportType: "general", recipientUserId: 5 }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("sendSupportMessage", () => {
  it("sends under the caller's own session", async () => {
    const message = await sendSupportMessage(supabase, {
      message: "help",
      sessionId: 31,
      userId: 5,
      role: ROLES.ATTENDEE,
      supportType: "general",
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
      supportType: "general",
      recipientUserId: 5,
    });

    expect(chatDao.sendMessage).toHaveBeenCalledWith({}, expect.objectContaining({ recipient_user_id: 5 }));
  });

  it("reports a message that could not be stored", async () => {
    chatDao.sendMessage.mockResolvedValue(null);

    await expect(
      sendSupportMessage(supabase, { message: "help", sessionId: 31, userId: 5, role: ROLES.ATTENDEE, supportType: "general" }),
    ).rejects.toMatchObject({ status: 500 });
  });
});

describe("claimCase", () => {
  it("claims an unclaimed general case", async () => {
    const session = await claimCase(supabase, 99, "general", 1);

    expect(session).toEqual({ id: 50, status: "active" });
    expect(chatDao.claimSession).toHaveBeenCalledWith({}, 99, "general", 1);
  });

  it("refuses to claim your own session", async () => {
    await expect(claimCase(supabase, 1, "general", 1)).rejects.toMatchObject({ status: 400 });
  });

  it("refuses case claiming for event support", async () => {
    await expect(claimCase(supabase, 99, "event", 1)).rejects.toMatchObject({ status: 400 });
  });

  it("reports a case somebody else already claimed", async () => {
    chatDao.claimSession.mockResolvedValue(null);

    await expect(claimCase(supabase, 99, "general", 1)).rejects.toMatchObject({ status: 409 });
  });
});

describe("releaseCase", () => {
  it("relinquishes a case the caller owns", async () => {
    const session = await releaseCase(supabase, 99, "general", 1);

    expect(session).toEqual({ id: 50, status: "active" });
    expect(chatDao.relinquishSession).toHaveBeenCalledWith({}, 99, "general", 1);
  });

  it("refuses to relinquish a case the caller does not own", async () => {
    chatDao.relinquishSession.mockResolvedValue(null);

    await expect(releaseCase(supabase, 99, "general", 1)).rejects.toMatchObject({ status: 409 });
  });
});

describe("endCase", () => {
  it("ends your own session", async () => {
    const session = await endCase(supabase, 5, "general", { id: 5, role: ROLES.ATTENDEE });

    expect(session).toEqual({ id: 50, status: "ended" });
    expect(chatDao.endSession).toHaveBeenCalledWith({}, 5, "general");
  });

  it("lets an admin close an unclaimed general case for someone else", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 7, assigned_to: null });

    await endCase(supabase, 99, "general", { id: 1, role: ROLES.ADMIN });

    expect(chatDao.endSession).toHaveBeenCalledWith({}, 99, "general", undefined, { ownerId: null });
  });

  it("lets the assigned handler close the case", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 7, assigned_to: 1 });

    await endCase(supabase, 99, "general", { id: 1, role: ROLES.ADMIN });

    expect(chatDao.endSession).toHaveBeenCalledWith({}, 99, "general", undefined, { ownerId: 1 });
  });

  it("stops an admin ending a case that belongs to another handler", async () => {
    chatDao.findActiveSession.mockResolvedValue({ id: 7, assigned_to: 2 });

    await expect(endCase(supabase, 99, "general", { id: 1, role: ROLES.ADMIN })).rejects.toMatchObject({ status: 403 });
  });

  it("reports when the target has no active case", async () => {
    await expect(endCase(supabase, 99, "general", { id: 1, role: ROLES.ADMIN })).rejects.toMatchObject({ status: 404 });
  });

  it("leaves event cases a free-for-all", async () => {
    await endCase(supabase, 99, "event", { id: 1, role: ROLES.ADMIN });

    expect(chatDao.endSession).toHaveBeenCalledWith({}, 99, "event");
  });
});

describe("SupportServiceError", () => {
  it("carries the status a route maps to NextResponse", () => {
    const err = new SupportServiceError(429, "Too many messages");

    expect(err.status).toBe(429);
    expect(err.message).toBe("Too many messages");
  });
});
