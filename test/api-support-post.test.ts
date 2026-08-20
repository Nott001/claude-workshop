import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireRole, countRecentByUser, findActiveSession, createSession, sendMessage, deleteSessionsExcept } = vi.hoisted(
  () => ({
    requireRole: vi.fn(),
    countRecentByUser: vi.fn(),
    findActiveSession: vi.fn(),
    createSession: vi.fn(),
    sendMessage: vi.fn(),
    deleteSessionsExcept: vi.fn(),
  }),
);

vi.mock("@/modules/auth/lib/role-guard", () => ({ requireRole }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/chat.dao", () => ({
  countRecentByUser,
  findActiveSession,
  createSession,
  sendMessage,
  deleteSessionsExcept,
  listSupportMessages: vi.fn(),
}));

import { POST } from "@/app/api/support/route";

const user = { id: 5, role: ROLES.ATTENDEE, full_name: "Jane", email: "jane@example.com" };
const post = () => new Request("https://app.test/api/support", { method: "POST", body: JSON.stringify({ message: "help" }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireRole.mockResolvedValue({ allowed: true, error: null, user });
  countRecentByUser.mockResolvedValue(0);
  findActiveSession.mockResolvedValue(null);
  createSession.mockResolvedValue({ id: 31 });
  sendMessage.mockResolvedValue({ id: 100, message: "help" });
  deleteSessionsExcept.mockResolvedValue(true);
});

describe("session creation failure", () => {
  // `newSession!.id` asserted non-null on a DAO that returns null on failure,
  // so an insert error surfaced as a TypeError rather than a handled response.
  it("returns a handled 500 when the session cannot be created", async () => {
    createSession.mockResolvedValue(null);

    const res = await POST(post());

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to start a support session" });
    // The message must not be attempted against a session that does not exist.
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("sends against a newly created session on the happy path", async () => {
    const res = await POST(post());

    expect(res.status).toBe(201);
    expect(sendMessage).toHaveBeenCalledWith({}, expect.objectContaining({ session_id: 31 }));
  });

  it("reuses an active session rather than creating one", async () => {
    findActiveSession.mockResolvedValue({ id: 12 });

    const res = await POST(post());

    expect(res.status).toBe(201);
    expect(createSession).not.toHaveBeenCalled();
    expect(sendMessage).toHaveBeenCalledWith({}, expect.objectContaining({ session_id: 12 }));
  });
});

describe("staff ownership of a general case", () => {
  const admin = { id: 1, role: ROLES.ADMIN, full_name: "Admin", email: "admin@example.com" };
  const staffPost = (body: Record<string, unknown>) =>
    new Request("https://app.test/api/support", {
      method: "POST",
      body: JSON.stringify({ message: "hello", ...body }),
    });

  beforeEach(() => {
    requireRole.mockResolvedValue({ allowed: true, error: null, user: admin });
  });

  it("lets the assigned handler reply to the asker's case", async () => {
    findActiveSession.mockResolvedValue({ id: 31, case_number: 100, assigned_to: 1 });

    const res = await POST(staffPost({ recipient_user_id: 5 }));

    expect(res.status).toBe(201);
    expect(sendMessage).toHaveBeenCalledWith({}, expect.objectContaining({ session_id: 31, recipient_user_id: 5 }));
    expect(createSession).not.toHaveBeenCalled();
  });

  it("refuses a reply to a case that has not been claimed", async () => {
    findActiveSession.mockResolvedValue({ id: 31, case_number: 100, assigned_to: null });

    const res = await POST(staffPost({ recipient_user_id: 5 }));

    expect(res.status).toBe(409);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("refuses a reply to a case owned by another staff member", async () => {
    findActiveSession.mockResolvedValue({ id: 31, case_number: 100, assigned_to: 2 });

    const res = await POST(staffPost({ recipient_user_id: 5 }));

    expect(res.status).toBe(403);
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("reports when the reply targets a user with no active case", async () => {
    findActiveSession.mockResolvedValue(null);

    const res = await POST(staffPost({ recipient_user_id: 5 }));

    expect(res.status).toBe(404);
    expect(sendMessage).not.toHaveBeenCalled();
  });
});
