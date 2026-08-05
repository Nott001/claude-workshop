import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, countRecentByUser, findActiveSession, createSession, sendMessage } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  countRecentByUser: vi.fn(),
  findActiveSession: vi.fn(),
  createSession: vi.fn(),
  sendMessage: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/chat.dao", () => ({
  countRecentByUser,
  findActiveSession,
  createSession,
  sendMessage,
  listSupportMessages: vi.fn(),
}));

import { POST } from "@/app/api/support/route";

const user = { id: 5, role: "attendee", full_name: "Jane", email: "jane@example.com" };
const post = () => new Request("https://app.test/api/support", { method: "POST", body: JSON.stringify({ message: "help" }) });

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(user);
  countRecentByUser.mockResolvedValue(0);
  findActiveSession.mockResolvedValue(null);
  createSession.mockResolvedValue({ id: 31 });
  sendMessage.mockResolvedValue({ id: 100, message: "help" });
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
