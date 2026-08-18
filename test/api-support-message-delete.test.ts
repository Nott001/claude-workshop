import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { requireAuth, findMessageWithUser, deleteMessagesByIds, findById } = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findMessageWithUser: vi.fn(),
  deleteMessagesByIds: vi.fn(),
  findById: vi.fn(),
}));

vi.mock("@/modules/auth/lib/session", () => ({ requireAuth }));
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => ({}) }));
vi.mock("@/shared/db/dao/chat.dao", () => ({ findMessageWithUser, deleteMessagesByIds }));
vi.mock("@/shared/db/dao/support-session.dao", () => ({ findById }));

import { DELETE } from "@/app/api/support/[messageId]/route";

const ATTENDEE = { id: 12, role: ROLES.ATTENDEE };

function del(id: string) {
  return DELETE(new Request(`https://app.test/api/support/${id}`), {
    params: Promise.resolve({ messageId: id }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  requireAuth.mockResolvedValue(ATTENDEE);
  findMessageWithUser.mockResolvedValue(null);
  deleteMessagesByIds.mockResolvedValue(true);
  findById.mockResolvedValue(null);
});

describe("DELETE /api/support/[messageId]", () => {
  it("refuses a caller with no session", async () => {
    requireAuth.mockResolvedValue(null);

    expect((await del("5")).status).toBe(401);
    expect(deleteMessagesByIds).not.toHaveBeenCalled();
  });

  it("404s when the message does not exist", async () => {
    expect((await del("5")).status).toBe(404);
    expect(deleteMessagesByIds).not.toHaveBeenCalled();
  });

  it("forbids a bystander who is not the recipient nor an admin", async () => {
    findMessageWithUser.mockResolvedValue({ id: 5, user_id: 9, recipient_user_id: 9 });
    findById.mockResolvedValue(null);

    expect((await del("5")).status).toBe(403);
    expect(deleteMessagesByIds).not.toHaveBeenCalled();
  });

  it("lets the sender remove their own message", async () => {
    findMessageWithUser.mockResolvedValue({ id: 5, user_id: 12, recipient_user_id: null });

    expect((await del("5")).status).toBe(200);
    expect(deleteMessagesByIds).toHaveBeenCalledWith(expect.anything(), [5]);
  });

  it("reports a failed delete as a server error", async () => {
    deleteMessagesByIds.mockResolvedValue(false);
    findMessageWithUser.mockResolvedValue({ id: 5, user_id: 12, recipient_user_id: null });

    expect((await del("5")).status).toBe(500);
  });
});
