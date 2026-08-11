import { describe, it, expect, vi } from "vitest";
import * as communityDao from "@/modules/community/db/community.dao";
import type { DbClient } from "@/shared/db/dao/types";

function queryStub(resolver: (chain: Record<string, unknown>) => unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["eq", "order", "limit", "insert", "update", "delete"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.select = vi.fn(() => chain);
  chain.maybeSingle = vi.fn(() => Promise.resolve(resolver(chain)));
  chain.single = vi.fn(() => Promise.resolve(resolver(chain)));
  // `list` and `remove` await the query chain itself (no terminal `.single()`),
  // so the chain has to be thenable to answer `{ data, error }`.
  chain.then = (onfulfilled: (value: unknown) => unknown) => Promise.resolve(resolver(chain)).then(onfulfilled);
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as DbClient, chain };
}

describe("community.dao.list", () => {
  it("hides hidden cards by default and orders by sequence_order", async () => {
    const { client, chain } = queryStub(() => ({
      data: [{ id: 1, label: "A" }],
      error: null,
    }));

    await communityDao.list(client, false);

    expect(chain.order).toHaveBeenCalledWith("sequence_order", { ascending: true });
    expect(chain.eq).toHaveBeenCalledWith("is_hidden", false);
  });

  it("does not filter hidden cards when includeHidden is true", async () => {
    const { client, chain } = queryStub(() => ({ data: [], error: null }));

    await communityDao.list(client, true);

    expect(chain.eq).not.toHaveBeenCalled();
  });

  it("returns the rows the query answered", async () => {
    const { client } = queryStub(() => ({
      data: [
        { id: 1, label: "A" },
        { id: 2, label: "B" },
      ],
      error: null,
    }));

    await expect(communityDao.list(client, false)).resolves.toHaveLength(2);
  });

  it("surfaces a failed read instead of returning an empty list", async () => {
    const { client } = queryStub(() => ({ data: null, error: { message: "boom", code: "PGRST" } }));

    await expect(communityDao.list(client, false)).rejects.toThrow("boom");
  });
});

describe("community.dao.findById", () => {
  it("targets the row by id", async () => {
    const { client, chain } = queryStub(() => ({
      data: { id: 3, label: "Facebook" },
      error: null,
    }));

    const link = await communityDao.findById(client, 3);

    expect(link?.label).toBe("Facebook");
    expect(chain.eq).toHaveBeenCalledWith("id", 3);
  });

  it("resolves null on a clean miss", async () => {
    const { client } = queryStub(() => ({ data: null, error: null }));

    await expect(communityDao.findById(client, 999)).resolves.toBeNull();
  });
});

describe("community.dao.getMaxSequenceOrder", () => {
  it("returns the highest sequence_order present", async () => {
    const { client } = queryStub(() => ({ data: { sequence_order: 7 }, error: null }));

    await expect(communityDao.getMaxSequenceOrder(client)).resolves.toBe(7);
  });

  it("returns 0 when no cards exist", async () => {
    const { client } = queryStub(() => ({ data: null, error: null }));

    await expect(communityDao.getMaxSequenceOrder(client)).resolves.toBe(0);
  });
});

describe("community.dao.create", () => {
  it("records the actor as created_by", async () => {
    const { client, chain } = queryStub(() => ({
      data: { id: 3, label: "WhatsApp" },
      error: null,
    }));

    await communityDao.create(
      client,
      { label: "WhatsApp", url: "https://t.me/x", description: null, icon_url: null, sequence_order: 2 },
      9,
    );

    expect(chain.insert).toHaveBeenCalledWith({
      label: "WhatsApp",
      url: "https://t.me/x",
      description: null,
      icon_url: null,
      sequence_order: 2,
      created_by: 9,
    });
  });

  it("returns null when the insert fails", async () => {
    const { client } = queryStub(() => ({ data: null, error: { message: "no", code: "23505" } }));

    await expect(
      communityDao.create(client, { label: "A", url: "https://x", description: null, icon_url: null, sequence_order: 1 }, 9),
    ).resolves.toBeNull();
  });
});

describe("community.dao.update", () => {
  it("targets the row by id and returns the refreshed card", async () => {
    const { client, chain } = queryStub(() => ({
      data: { id: 3, is_hidden: true },
      error: null,
    }));

    const link = await communityDao.update(client, 3, { is_hidden: true });

    expect(link?.is_hidden).toBe(true);
    expect(chain.eq).toHaveBeenCalledWith("id", 3);
  });

  it("returns null when the update fails", async () => {
    const { client } = queryStub(() => ({ data: null, error: { message: "no", code: "42P01" } }));

    await expect(communityDao.update(client, 3, { label: "X" })).resolves.toBeNull();
  });
});

describe("community.dao.remove", () => {
  it("reports success when the delete resolves cleanly", async () => {
    const { client } = queryStub(() => ({ error: null }));

    await expect(communityDao.remove(client, 3)).resolves.toBe(true);
  });

  it("reports failure when the delete errors", async () => {
    const { client } = queryStub(() => ({ error: { message: "no", code: "23503" } }));

    await expect(communityDao.remove(client, 3)).resolves.toBe(false);
  });
});
