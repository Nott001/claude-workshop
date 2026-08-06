import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, chatDao } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  chatDao: {
    listRecentSessions: vi.fn(),
    listRecentSupportMessages: vi.fn(),
    listActiveSessions: vi.fn(),
    findActiveSession: vi.fn(),
    createSession: vi.fn(),
    endSession: vi.fn(),
  },
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/chat.dao", () => chatDao);

import { GET as listUsers } from "@/app/api/support/users/route";
import { GET as listSessions, POST as sessionAction } from "@/app/api/support/sessions/route";

const ATTENDEE = { id: 12, role: "attendee" };
const FACILITATOR = { id: 3, role: "facilitator" };
const ADMIN = { id: 1, role: "admin" };

function action(payload: unknown) {
  return new Request("https://app.test/api/support/sessions", { method: "POST", body: JSON.stringify(payload) });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(FACILITATOR);
  chatDao.listRecentSessions.mockResolvedValue([]);
  chatDao.listRecentSupportMessages.mockResolvedValue([]);
  chatDao.listActiveSessions.mockResolvedValue([]);
  chatDao.findActiveSession.mockResolvedValue(null);
  chatDao.createSession.mockResolvedValue({ id: 50, status: "active" });
  chatDao.endSession.mockResolvedValue({ id: 50, status: "ended" });
});

describe("GET /api/support/users", () => {
  it("refuses an attendee", async () => {
    requireAuth.mockResolvedValue(ATTENDEE);

    const res = await listUsers();

    expect(res.status).toBe(403);
    expect(chatDao.listRecentSupportMessages).not.toHaveBeenCalled();
  });

  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    expect((await listUsers()).status).toBe(403);
  });

  it("lists one entry per asker, newest conversation first", async () => {
    chatDao.listRecentSessions.mockResolvedValue([
      { id: 2, user_id: 20, status: "active" },
      { id: 1, user_id: 21, status: "ended" },
    ]);
    chatDao.listRecentSupportMessages.mockResolvedValue([
      {
        user_id: 20,
        recipient_user_id: null,
        message: "newer",
        sent_at: "2026-08-05T10:00:00Z",
        session_id: 2,
        USER: { full_name: "Ana", role: "attendee" },
      },
      {
        user_id: 21,
        recipient_user_id: null,
        message: "older",
        sent_at: "2026-08-05T09:00:00Z",
        session_id: 1,
        USER: { full_name: "Ben", role: "attendee" },
      },
    ]);

    const { users } = await (await listUsers()).json();

    expect(users.map((u: { full_name: string }) => u.full_name)).toEqual(["Ana", "Ben"]);
    expect(users[0]).toMatchObject({ user_id: 20, last_message: "newer", session_active: true });
    expect(users[1].session_active).toBe(false);
  });

  it("leaves staff out of the queue of people waiting for help", async () => {
    // A facilitator answering support is not themselves an asker.
    chatDao.listRecentSessions.mockResolvedValue([{ id: 3, user_id: 30, status: "active" }]);
    chatDao.listRecentSupportMessages.mockResolvedValue([
      {
        user_id: 30,
        recipient_user_id: null,
        message: "on it",
        sent_at: "2026-08-05T10:00:00Z",
        session_id: 3,
        USER: { full_name: "Staffer", role: "facilitator" },
      },
    ]);

    const { users } = await (await listUsers()).json();

    expect(users).toEqual([]);
  });

  it("ignores messages from a conversation the asker has already left behind", async () => {
    chatDao.listRecentSessions.mockResolvedValue([{ id: 9, user_id: 40, status: "active" }]);
    chatDao.listRecentSupportMessages.mockResolvedValue([
      {
        user_id: 40,
        recipient_user_id: null,
        message: "from an old session",
        sent_at: "2026-08-05T10:00:00Z",
        session_id: 8,
        USER: { full_name: "Cara", role: "attendee" },
      },
    ]);

    const { users } = await (await listUsers()).json();

    expect(users).toEqual([]);
  });

  it("shows the staff reply as the latest word when it is newer", async () => {
    chatDao.listRecentSessions.mockResolvedValue([{ id: 5, user_id: 50, status: "active" }]);
    chatDao.listRecentSupportMessages.mockResolvedValue([
      {
        user_id: 50,
        recipient_user_id: null,
        message: "my question",
        sent_at: "2026-08-05T10:00:00Z",
        session_id: 5,
        USER: { full_name: "Dee", role: "attendee" },
      },
      {
        user_id: 3,
        recipient_user_id: 50,
        message: "our answer",
        sent_at: "2026-08-05T11:00:00Z",
        session_id: 5,
        USER: { full_name: "Staffer", role: "facilitator" },
      },
    ]);

    const { users } = await (await listUsers()).json();

    expect(users[0]).toMatchObject({ user_id: 50, last_message: "our answer" });
  });

  it("falls back to a name rather than rendering nothing for a missing user row", async () => {
    chatDao.listRecentSessions.mockResolvedValue([{ id: 6, user_id: 60, status: "active" }]);
    chatDao.listRecentSupportMessages.mockResolvedValue([
      { user_id: 60, recipient_user_id: null, message: "hello", sent_at: "2026-08-05T10:00:00Z", session_id: 6, USER: null },
    ]);

    const { users } = await (await listUsers()).json();

    expect(users[0].full_name).toBe("Unknown");
  });
});

describe("GET /api/support/sessions", () => {
  it("refuses an attendee", async () => {
    requireAuth.mockResolvedValue(ATTENDEE);

    expect((await listSessions()).status).toBe(403);
  });

  it("lists the active sessions for staff", async () => {
    chatDao.listActiveSessions.mockResolvedValue([{ id: 1 }]);

    const res = await listSessions();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ sessions: [{ id: 1 }] });
  });
});

describe("POST /api/support/sessions", () => {
  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    expect((await sessionAction(action({ action: "start" }))).status).toBe(401);
  });

  it("lets anyone start their own conversation", async () => {
    requireAuth.mockResolvedValue(ATTENDEE);

    const res = await sessionAction(action({ action: "start" }));

    expect(res.status).toBe(200);
    expect(chatDao.createSession).toHaveBeenCalledWith({}, 12, "general");
  });

  it("returns the conversation already open instead of starting a second", async () => {
    requireAuth.mockResolvedValue(ATTENDEE);
    chatDao.findActiveSession.mockResolvedValue({ id: 77, status: "active" });

    const res = await sessionAction(action({ action: "start" }));

    await expect(res.json()).resolves.toEqual({ session: { id: 77, status: "active" } });
    expect(chatDao.createSession).not.toHaveBeenCalled();
  });

  it("reports a conversation that could not be started", async () => {
    requireAuth.mockResolvedValue(ATTENDEE);
    chatDao.createSession.mockResolvedValue(null);

    expect((await sessionAction(action({ action: "start" }))).status).toBe(500);
  });

  it("stops an attendee ending somebody else's conversation", async () => {
    requireAuth.mockResolvedValue(ATTENDEE);

    const res = await sessionAction(action({ action: "end", user_id: 99 }));

    expect(res.status).toBe(403);
    expect(chatDao.endSession).not.toHaveBeenCalled();
  });

  it("needs admin, not facilitator, to end a general conversation for someone else", async () => {
    // General support is the admin queue; event support is the facilitator one.
    const res = await sessionAction(action({ action: "end", user_id: 99, support_type: "general" }));

    expect(res.status).toBe(403);
  });

  it("lets a facilitator end somebody's event conversation", async () => {
    const res = await sessionAction(action({ action: "end", user_id: 99, support_type: "event" }));

    expect(res.status).toBe(200);
    expect(chatDao.endSession).toHaveBeenCalledWith({}, 99, "event");
  });

  it("lets an admin end a general conversation for someone else", async () => {
    requireAuth.mockResolvedValue(ADMIN);

    const res = await sessionAction(action({ action: "end", user_id: 99 }));

    expect(res.status).toBe(200);
  });

  it("refuses to start a conversation on somebody else's behalf", async () => {
    requireAuth.mockResolvedValue(ADMIN);

    const res = await sessionAction(action({ action: "start", user_id: 99 }));

    expect(res.status).toBe(400);
    expect(chatDao.createSession).not.toHaveBeenCalled();
  });

  it("answers with null rather than failing when there was nothing to end", async () => {
    requireAuth.mockResolvedValue(ATTENDEE);
    chatDao.endSession.mockResolvedValue(null);

    const res = await sessionAction(action({}));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ session: null });
  });
});
