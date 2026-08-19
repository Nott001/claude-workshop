import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dao from "@/shared/db/dao/chat-message.dao";
import type { DbClient } from "@/shared/db/dao/types";

function stub(result: { data?: unknown; error?: unknown; count?: number | null } = { data: [] }) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ["select", "eq", "is", "gt", "lt", "gte", "in", "order", "limit", "insert", "update", "delete"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }
  return { client: { from: vi.fn(() => chain) } as unknown as DbClient, calls };
}

const argsOf = (calls: Array<[string, unknown[]]>, method: string) => calls.find(([m]) => m === method)?.[1];
const names = (calls: Array<[string, unknown[]]>) => calls.map(([m]) => m);
const page = (count: number, from = 0) =>
  Array.from({ length: count }, (_, i) => ({ id: from + i, sent_at: `2026-08-05T00:0${from + i}:00Z` }));

beforeEach(() => vi.clearAllMocks());

describe("chat-message.dao reads", () => {
  it("carries the sender's name and role alongside a message", async () => {
    const { client, calls } = stub({ data: { id: 1, USER: { full_name: "Ana", role: ROLES.ATTENDEE } } });

    await expect(dao.findMessageWithUser(client, 1)).resolves.toMatchObject({ USER: { full_name: "Ana" } });
    expect(argsOf(calls, "select")).toEqual(["*, USER:user_id(full_name, role)"]);
  });

  it("reads only what a permission check needs", async () => {
    const { client, calls } = stub({ data: { id: 1 } });

    await dao.findMessageById(client, 1);

    expect(argsOf(calls, "select")).toEqual(["id"]);
  });
});

describe("chat-message.dao listMessages", () => {
  const options = { before: null, after: null, limit: 2 };

  it("asks for one row more than the page, to learn whether more exist", async () => {
    const { client, calls } = stub({ data: page(2) });

    await dao.listMessages(client, "general", options);

    expect(argsOf(calls, "limit")).toEqual([3]);
  });

  it("reports a cursor only when there is another page", async () => {
    const full = stub({ data: page(3) });
    const partial = stub({ data: page(2) });

    const more = await dao.listMessages(full.client, "general", options);
    const last = await dao.listMessages(partial.client, "general", options);

    expect(more.messages).toHaveLength(2);
    expect(more.nextCursor).toBe(more.messages[0].sent_at);
    expect(last.nextCursor).toBeNull();
  });

  it("hands back the newest page in reading order", async () => {
    // The query sorts newest-first so the cursor works; the transcript has to
    // arrive oldest-first or the conversation reads backwards.
    const { client } = stub({
      data: [
        { id: 2, sent_at: "b" },
        { id: 1, sent_at: "a" },
      ],
    });

    const { messages } = await dao.listMessages(client, "general", options);

    expect(messages.map((m) => m.id)).toEqual([1, 2]);
  });

  it("keeps a catch-up poll in the order it arrived", async () => {
    const { client, calls } = stub({
      data: [
        { id: 1, sent_at: "a" },
        { id: 2, sent_at: "b" },
      ],
    });

    const { messages } = await dao.listMessages(client, "general", { before: null, after: "a", limit: 2 });

    expect(messages.map((m) => m.id)).toEqual([1, 2]);
    expect(argsOf(calls, "gt")).toEqual(["sent_at", "a"]);
    expect(argsOf(calls, "order")).toEqual(["sent_at", { ascending: true }]);
  });

  it("scopes to the general support thread", async () => {
    const { client, calls } = stub({ data: [] });

    await dao.listMessages(client, "general", options);

    expect(argsOf(calls, "eq")).toEqual(["support_type", "general"]);
  });

  it("walks backwards from a cursor when one is given", async () => {
    const { client, calls } = stub({ data: [] });

    await dao.listMessages(client, "general", { before: "2026-08-05T00:00:00Z", after: null, limit: 2 });

    expect(argsOf(calls, "lt")).toEqual(["sent_at", "2026-08-05T00:00:00Z"]);
  });
});

describe("chat-message.dao writes", () => {
  it("returns the stored message with its sender attached", async () => {
    const { client, calls } = stub({ data: { id: 5 }, error: null });

    await expect(dao.sendMessage(client, { support_type: "general", user_id: 3, message: "hi" })).resolves.toMatchObject({
      id: 5,
    });
    expect(argsOf(calls, "select")).toEqual(["*, USER:user_id(full_name, role)"]);
  });

  it("reports a message that failed to save as nothing saved", async () => {
    const { client } = stub({ data: null, error: { message: "insert failed" } });

    await expect(dao.sendMessage(client, { support_type: "general", user_id: 3, message: "hi" })).resolves.toBeNull();
  });

  it("counts a user's recent messages without fetching them", async () => {
    const { client, calls } = stub({ count: 4 });

    await expect(dao.countRecentByUser(client, 3, "general", "2026-08-05T00:00:00Z")).resolves.toBe(4);
    expect(argsOf(calls, "select")).toEqual(["*", { count: "exact", head: true }]);
  });

  it("counts zero rather than nothing when the window is empty", async () => {
    const { client } = stub({ count: null });

    await expect(dao.countRecentByUser(client, 3, "general", "2026-08-05T00:00:00Z")).resolves.toBe(0);
  });

  it("hard-deletes the given message ids outright", async () => {
    const ok = stub({ error: null });
    const failed = stub({ error: { message: "delete blocked" } });

    await expect(dao.deleteMessagesByIds(ok.client, [1, 2])).resolves.toBe(true);
    expect(argsOf(ok.calls, "in")).toEqual(["id", [1, 2]]);
    expect(names(ok.calls)).toContain("delete");
    expect(names(ok.calls)).not.toContain("update");

    await expect(dao.deleteMessagesByIds(failed.client, [1, 2])).resolves.toBe(false);
  });

  it("erases a user's own messages and the ones addressed to them separately", async () => {
    const sent = stub({ error: null });
    const received = stub({ error: null });

    await dao.deleteMessagesByUser(sent.client, 3);
    await dao.deleteMessagesByRecipient(received.client, 3);

    expect(argsOf(sent.calls, "eq")).toEqual(["user_id", 3]);
    expect(argsOf(received.calls, "eq")).toEqual(["recipient_user_id", 3]);
  });
});
