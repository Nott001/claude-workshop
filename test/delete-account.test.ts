import { ROLES } from "@/shared/lib/roles";
import type { DeleteAccountInput } from "@/modules/user/lib/delete-account";
import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.mock is hoisted above the module body, so the doubles it closes over must
// be created inside vi.hoisted rather than as plain consts.
const {
  endCase,
  deleteMessagesByUser,
  deleteMessagesByRecipient,
  deleteTicketRows,
  deleteQaRows,
  deleteResponsesByUser,
  deleteEmailLogRows,
  deleteByEmail,
  removeByUserId,
  updateUser,
  listStorageFolder,
  deleteFromStorage,
  deleteAuthUser,
} = vi.hoisted(() => ({
  endCase: vi.fn(),
  deleteMessagesByUser: vi.fn(),
  deleteMessagesByRecipient: vi.fn(),
  deleteTicketRows: vi.fn(),
  deleteQaRows: vi.fn(),
  deleteResponsesByUser: vi.fn(),
  deleteEmailLogRows: vi.fn(),
  deleteByEmail: vi.fn(),
  removeByUserId: vi.fn(),
  updateUser: vi.fn(),
  listStorageFolder: vi.fn(),
  deleteFromStorage: vi.fn(),
  deleteAuthUser: vi.fn(),
}));

vi.mock("@/modules/chat/lib/support-service", () => ({ endCase }));
vi.mock("@/shared/db/dao/chat.dao", () => ({ deleteMessagesByUser, deleteMessagesByRecipient }));
vi.mock("@/shared/db/dao/ticket.dao", () => ({ deleteByUser: deleteTicketRows }));
vi.mock("@/modules/courses/qa/db/qa-message.dao", () => ({ deleteByUser: deleteQaRows }));
vi.mock("@/modules/surveys/db/survey.dao", () => ({ deleteResponsesByUser }));
vi.mock("@/shared/db/dao/email.dao", () => ({ deleteByUser: deleteEmailLogRows }));
vi.mock("@/shared/db/dao/password-reset.dao", () => ({ deleteByEmail }));
vi.mock("@/shared/db/dao/speaker.dao", () => ({ removeByUserId }));
vi.mock("@/shared/db/dao/user.dao", () => ({ updateUser }));
vi.mock("@/shared/integrations/storage/service", () => ({ listStorageFolder, deleteFromStorage }));

const client = { auth: { admin: { deleteUser: deleteAuthUser } } } as never;
vi.mock("@/shared/db/client", () => ({ getServiceClient: () => client }));

import { deleteAccount } from "@/modules/user/lib/delete-account";

const input: DeleteAccountInput = {
  userId: 7,
  authUserId: "auth_7",
  email: "ada@example.com",
  role: ROLES.ATTENDEE,
};

const purges = [
  { name: "ticket rows", fn: deleteTicketRows },
  { name: "QA messages", fn: deleteQaRows },
  { name: "survey responses", fn: deleteResponsesByUser },
  { name: "email log rows", fn: deleteEmailLogRows },
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  deleteMessagesByUser.mockResolvedValue(true);
  deleteMessagesByRecipient.mockResolvedValue(true);
  deleteTicketRows.mockResolvedValue(true);
  deleteQaRows.mockResolvedValue(true);
  deleteResponsesByUser.mockResolvedValue(true);
  deleteEmailLogRows.mockResolvedValue(true);
  deleteByEmail.mockResolvedValue(true);
  removeByUserId.mockResolvedValue(true);
  updateUser.mockResolvedValue({ id: input.userId });
  deleteAuthUser.mockResolvedValue({ error: null });
  listStorageFolder.mockResolvedValue([]);
  deleteFromStorage.mockResolvedValue(undefined);
});

describe("deleteAccount", () => {
  it("purges every owned table with the right identity, then anonymizes and deletes the auth identity", async () => {
    const paths = ["users/7/profile_1.jpg", "users/7/profile_2.jpg"];
    listStorageFolder.mockResolvedValue(paths);

    await expect(deleteAccount(input)).resolves.toBeUndefined();

    expect(endCase).toHaveBeenCalledWith(client, 7, { id: 7, role: ROLES.ATTENDEE });
    expect(deleteMessagesByUser).toHaveBeenCalledWith(client, 7);
    expect(deleteMessagesByRecipient).toHaveBeenCalledWith(client, 7);
    for (const { fn } of purges) {
      expect(fn).toHaveBeenCalledWith(client, 7);
    }
    expect(deleteByEmail).toHaveBeenCalledWith(client, "ada@example.com");
    expect(removeByUserId).toHaveBeenCalledWith(client, 7);

    expect(listStorageFolder).toHaveBeenCalledWith("profile_images", "users/7");
    expect(deleteFromStorage).toHaveBeenCalledWith("profile_images", paths);

    expect(updateUser).toHaveBeenCalledWith(client, "auth_7", {
      full_name: "Deleted User",
      email: "deleted-7@deleted.local",
      profile_image_url: null,
    });
    expect(deleteAuthUser).toHaveBeenCalledWith("auth_7");
  });

  it("succeeds when the storage folder cannot be listed", async () => {
    listStorageFolder.mockRejectedValueOnce(new Error("storage down"));

    await expect(deleteAccount(input)).resolves.toBeUndefined();
    expect(deleteAuthUser).toHaveBeenCalledWith("auth_7");
  });

  it("succeeds when the storage removal throws", async () => {
    deleteFromStorage.mockRejectedValueOnce(new Error("storage down"));

    await expect(deleteAccount(input)).resolves.toBeUndefined();
    expect(deleteAuthUser).toHaveBeenCalledWith("auth_7");
  });

  it("throws and aborts before anonymize/auth-delete when any purge fails", async () => {
    for (const { name, fn } of purges) {
      fn.mockResolvedValue(false);

      await expect(deleteAccount(input)).rejects.toThrow(name);
      expect(updateUser).not.toHaveBeenCalled();
      expect(deleteAuthUser).not.toHaveBeenCalled();

      fn.mockResolvedValue(true);
    }
  });

  it("throws before anonymize when the chat-message purge fails", async () => {
    deleteMessagesByUser.mockResolvedValue(false);

    await expect(deleteAccount(input)).rejects.toThrow(/sent by the user/);
    expect(updateUser).not.toHaveBeenCalled();
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("throws when anonymizing the profile row comes back empty", async () => {
    updateUser.mockResolvedValue(null);

    await expect(deleteAccount(input)).rejects.toThrow(/anonymize/);
    expect(deleteAuthUser).not.toHaveBeenCalled();
  });

  it("throws when the auth identity deletion errors", async () => {
    deleteAuthUser.mockResolvedValue({ error: { message: "nope" } });

    await expect(deleteAccount(input)).rejects.toThrow(/nope/);
  });
});
