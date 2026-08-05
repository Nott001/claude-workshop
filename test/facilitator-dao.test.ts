import { describe, it, expect, vi } from "vitest";
import { listCandidates, listEventAssignments, replaceEventAssignments } from "@/shared/db/dao/facilitator.dao";
import type { DbClient } from "@/shared/db/dao/types";

function replaceStub({
  validIds = [],
  deleteError = null,
  insertError = null,
}: { validIds?: number[]; deleteError?: unknown; insertError?: unknown } = {}) {
  const userChain = {
    select: vi.fn(() => userChain),
    in: vi.fn(() => userChain),
    eq: vi.fn(() => Promise.resolve({ data: validIds.map((id) => ({ id })), error: null })),
  };
  const deleteChain = {
    eq: vi.fn(() => Promise.resolve({ error: deleteError })),
  };
  const efChain = {
    delete: vi.fn(() => deleteChain),
    insert: vi.fn(() => Promise.resolve({ error: insertError })),
  };
  const from = vi.fn((table: string) => (table === "USER" ? userChain : efChain));
  return { client: { from } as unknown as DbClient, from, userChain, efChain, deleteChain };
}

describe("facilitator.dao replaceEventAssignments", () => {
  it("replaces the event's facilitator set with the ids the role check returns", async () => {
    const { client, userChain, efChain } = replaceStub({ validIds: [2, 7] });

    const ok = await replaceEventAssignments(client, 10, [2, 7, 999], 9);

    expect(ok).toBe(true);
    expect(userChain.in).toHaveBeenCalledWith("id", [2, 7, 999]);
    expect(efChain.delete).toHaveBeenCalled();
    expect(efChain.insert).toHaveBeenCalledWith([
      { event_id: 10, user_id: 2, assigned_by: 9 },
      { event_id: 10, user_id: 7, assigned_by: 9 },
    ]);
  });

  it("clears the roster without inserting when nothing passes the role check", async () => {
    const { client, efChain } = replaceStub({ validIds: [] });

    const ok = await replaceEventAssignments(client, 10, [999], 9);

    expect(ok).toBe(true);
    expect(efChain.delete).toHaveBeenCalled();
    expect(efChain.insert).not.toHaveBeenCalled();
  });

  it("returns false when the delete fails", async () => {
    const { client, efChain } = replaceStub({ validIds: [2], deleteError: { message: "nope" } });

    await expect(replaceEventAssignments(client, 10, [2], 9)).resolves.toBe(false);
    expect(efChain.insert).not.toHaveBeenCalled();
  });

  it("returns false when the insert fails", async () => {
    const { client } = replaceStub({ validIds: [2], insertError: { message: "nope" } });

    await expect(replaceEventAssignments(client, 10, [2], 9)).resolves.toBe(false);
  });
});

describe("facilitator.dao listers", () => {
  it("lists only facilitator-role users ordered by name", async () => {
    const orderChain = {
      select: vi.fn(() => orderChain),
      eq: vi.fn(() => orderChain),
      order: vi.fn(() =>
        Promise.resolve({
          data: [{ id: 3, full_name: "Fay", email: "fay@example.com" }],
          error: null,
        }),
      ),
    };
    const from = vi.fn(() => orderChain);
    const client = { from } as unknown as DbClient;

    const rows = await listCandidates(client);

    expect(rows).toEqual([{ id: 3, full_name: "Fay", email: "fay@example.com" }]);
    expect(orderChain.eq).toHaveBeenCalledWith("role", "facilitator");
  });

  it("embeds the assignee's name and email", async () => {
    const eqChain = {
      select: vi.fn(() => eqChain),
      eq: vi.fn(() =>
        Promise.resolve({
          data: [
            {
              user_id: 3,
              assigned_by: 9,
              USER: { full_name: "Fay", email: "fay@example.com" },
            },
          ],
          error: null,
        }),
      ),
    };
    const from = vi.fn(() => eqChain);
    const client = { from } as unknown as DbClient;

    const rows = await listEventAssignments(client, 10);

    expect(rows[0]).toMatchObject({ user_id: 3, USER: { full_name: "Fay" } });
    expect(eqChain.eq).toHaveBeenCalledWith("event_id", 10);
  });
});
