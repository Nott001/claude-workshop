import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dao from "@/shared/db/dao/email-change-attempt.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * Records the query the DAO builds so tests can assert on the filters applied.
 * Every chainable method returns the same object; the terminal call resolves.
 */
function queryStub(result: { data?: unknown; error?: unknown; count?: number } = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};

  for (const method of ["select", "eq", "gte", "order", "limit", "insert", "delete"]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    });
  }
  const settled = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  chain.then = (resolve: (v: unknown) => unknown) => resolve(settled);

  const from = vi.fn(() => chain);
  return { client: { from } as unknown as DbClient, from, calls };
}

const WINDOW_START = "2026-08-17T11:45:00.000Z";

beforeEach(() => vi.clearAllMocks());

describe("recordAttempt", () => {
  it("writes the caller and origin against the ledger table", async () => {
    const { client, from, calls } = queryStub();

    await dao.recordAttempt(client, 7, "203.0.113.7");

    expect(from).toHaveBeenCalledWith("EMAIL_CHANGE_ATTEMPT");
    expect(calls).toContainEqual(["insert", [{ user_id: 7, ip: "203.0.113.7" }]]);
  });

  // A ledger write that fails must not take the request down with it; the
  // counts that follow decide the verdict.
  it("survives a failing insert", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { client } = queryStub({ error: { message: "nope" } });

    await expect(dao.recordAttempt(client, 7, null)).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe("countByUser / countByIp", () => {
  it("counts only this caller's rows inside the window", async () => {
    const { client, calls } = queryStub({ count: 3 });

    await expect(dao.countByUser(client, 7, WINDOW_START)).resolves.toBe(3);
    expect(calls).toContainEqual(["eq", ["user_id", 7]]);
    expect(calls).toContainEqual(["gte", ["created_at", WINDOW_START]]);
  });

  it("counts only this origin's rows inside the window", async () => {
    const { client, calls } = queryStub({ count: 9 });

    await expect(dao.countByIp(client, "203.0.113.7", WINDOW_START)).resolves.toBe(9);
    expect(calls).toContainEqual(["eq", ["ip", "203.0.113.7"]]);
  });

  it("reads an empty ledger as no attempts rather than as a failure", async () => {
    // Supabase answers a head-count of nothing with a null `count`, which must
    // not be confused with the unreadable case below.
    const { client } = queryStub();

    await expect(dao.countByUser(client, 7, WINDOW_START)).resolves.toBe(0);
  });

  // Fail closed: a counter that cannot be read must not leave an open mail
  // relay, so it reports a number no limit can be under.
  it("reports an unreadable counter as past every limit", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = queryStub({ error: { message: "connection lost" } });

    await expect(dao.countByUser(client, 7, WINDOW_START)).resolves.toBe(Number.MAX_SAFE_INTEGER);
    error.mockRestore();
  });
});

describe("deleteByUser", () => {
  // The rows outlive their rate-limit window and tie an account to an IP, and
  // no foreign key removes them when the account goes.
  it("drops every attempt this account made", async () => {
    const { client, from, calls } = queryStub();

    await expect(dao.deleteByUser(client, 7)).resolves.toBe(true);
    expect(from).toHaveBeenCalledWith("EMAIL_CHANGE_ATTEMPT");
    expect(calls).toContainEqual(["delete", []]);
    expect(calls).toContainEqual(["eq", ["user_id", 7]]);
  });

  // The teardown aborts on a false, so a failed purge must not read as done.
  it("reports a failed delete rather than swallowing it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { client } = queryStub({ error: { message: "connection lost" } });

    await expect(dao.deleteByUser(client, 7)).resolves.toBe(false);
    error.mockRestore();
  });
});

describe("nthOldestSince", () => {
  it("reads the nth oldest row of the slice, oldest first", async () => {
    const { client, calls } = queryStub({
      data: [{ created_at: "2026-08-17T11:50:00.000Z" }, { created_at: "2026-08-17T11:52:00.000Z" }],
    });

    await expect(dao.nthOldestSince(client, "user_id", 7, WINDOW_START, 2)).resolves.toBe("2026-08-17T11:52:00.000Z");
    expect(calls).toContainEqual(["order", ["created_at", { ascending: true }]]);
    expect(calls).toContainEqual(["limit", [2]]);
  });

  // The caller has already decided to refuse by this point; a ledger that
  // cannot say when a slot frees only costs the wait its exact wording.
  it("answers null when the slice holds fewer rows than asked for", async () => {
    const { client } = queryStub({ data: [{ created_at: "2026-08-17T11:50:00.000Z" }] });

    await expect(dao.nthOldestSince(client, "user_id", 7, WINDOW_START, 3)).resolves.toBeNull();
  });

  it("answers null when the read fails outright", async () => {
    const { client } = queryStub({ error: { message: "connection lost" } });

    await expect(dao.nthOldestSince(client, "ip", "203.0.113.7", WINDOW_START, 1)).resolves.toBeNull();
  });
});
