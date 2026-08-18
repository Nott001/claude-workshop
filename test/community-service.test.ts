import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";

const supabase = {} as unknown as DbClient;

const { list, findById, getMaxSequenceOrder, create, update, remove } = vi.hoisted(() => ({
  list: vi.fn(),
  findById: vi.fn(),
  getMaxSequenceOrder: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/modules/community/db/community.dao", () => ({
  list,
  findById,
  getMaxSequenceOrder,
  create,
  update,
  remove,
}));

import {
  createCommunityLink,
  deleteCommunityLink,
  listCommunityLinks,
  updateCommunityLink,
} from "@/modules/community/lib/community-service";

const card = {
  id: 1,
  label: "Facebook",
  url: "https://facebook.com/groups/x",
  description: null,
  icon_url: null,
  sequence_order: 1,
  is_hidden: false,
  created_by: 9,
  created_at: "2026-08-10T00:00:00Z",
  updated_at: "2026-08-10T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue([card]);
  findById.mockResolvedValue(card);
  getMaxSequenceOrder.mockResolvedValue(4);
  create.mockResolvedValue(card);
  update.mockResolvedValue(card);
  remove.mockResolvedValue(true);
});

describe("listCommunityLinks", () => {
  it("asks the DAO for every card when the caller is an admin", async () => {
    await listCommunityLinks(supabase, ROLES.ADMIN);
    expect(list).toHaveBeenCalledWith(supabase, true);
  });

  it("asks the DAO for visible cards only for a super_admin's subordinates and guests", async () => {
    await listCommunityLinks(supabase, ROLES.SUPER_ADMIN);
    expect(list).toHaveBeenCalledWith(supabase, true);
  });

  it("asks the DAO for visible cards only for an attendee", async () => {
    await listCommunityLinks(supabase, ROLES.ATTENDEE);
    expect(list).toHaveBeenCalledWith(supabase, false);
  });

  it("treats an anonymous caller like an attendee", async () => {
    await listCommunityLinks(supabase, null);
    expect(list).toHaveBeenCalledWith(supabase, false);
  });
});

describe("createCommunityLink", () => {
  it("defaults sequence_order to max + 1 when omitted", async () => {
    await createCommunityLink(supabase, { label: "WhatsApp", url: "https://t.me/x" }, { id: 9 });

    expect(getMaxSequenceOrder).toHaveBeenCalledWith(supabase);
    expect(create).toHaveBeenCalledWith(
      supabase,
      { label: "WhatsApp", url: "https://t.me/x", description: null, icon_url: null, sequence_order: 5 },
      9,
    );
  });

  it("honours an explicit sequence_order instead of computing one", async () => {
    await createCommunityLink(supabase, { label: "WhatsApp", url: "https://t.me/x", sequence_order: 2 }, { id: 9 });

    expect(getMaxSequenceOrder).not.toHaveBeenCalled();
    expect(create).toHaveBeenCalledWith(
      supabase,
      { label: "WhatsApp", url: "https://t.me/x", description: null, icon_url: null, sequence_order: 2 },
      9,
    );
  });

  it("throws a 500 when the write fails", async () => {
    create.mockResolvedValue(null);

    await expect(createCommunityLink(supabase, { label: "A", url: "https://x" }, { id: 9 })).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe("updateCommunityLink", () => {
  it("404s on a card that does not exist", async () => {
    findById.mockResolvedValue(null);

    await expect(updateCommunityLink(supabase, 999, { label: "X" })).rejects.toMatchObject({ status: 404 });
    expect(update).not.toHaveBeenCalled();
  });

  it("forwards only the supplied fields", async () => {
    await updateCommunityLink(supabase, 1, { is_hidden: true });

    expect(update).toHaveBeenCalledWith(supabase, 1, { is_hidden: true });
  });

  it("throws a 500 when the write fails", async () => {
    update.mockResolvedValue(null);

    await expect(updateCommunityLink(supabase, 1, { label: "X" })).rejects.toMatchObject({ status: 500 });
  });
});

describe("deleteCommunityLink", () => {
  it("404s on a card that does not exist", async () => {
    findById.mockResolvedValue(null);

    await expect(deleteCommunityLink(supabase, 999)).rejects.toMatchObject({ status: 404 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("removes the card and reports success", async () => {
    await expect(deleteCommunityLink(supabase, 1)).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(supabase, 1);
  });

  it("throws a 500 when the delete fails", async () => {
    remove.mockResolvedValue(false);

    await expect(deleteCommunityLink(supabase, 1)).rejects.toMatchObject({ status: 500 });
  });
});
