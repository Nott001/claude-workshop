import { describe, it, expect, vi, beforeEach } from "vitest";
import * as eventDao from "@/shared/db/dao/event.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * Mirrors the query stub in dao.test.ts: every chainable method records its
 * arguments and returns the same object, so a test can assert on the filters
 * the DAO applied without a database.
 */
function queryStub(result: { data?: unknown } = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};

  for (const method of ["select", "eq", "in", "gte", "lt", "order", "limit"]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    });
  }
  const settled = { data: result.data ?? [], error: null };
  chain.then = (resolve: (v: unknown) => unknown) => resolve(settled);

  const from = vi.fn(() => chain);
  return { client: { from } as unknown as DbClient, calls };
}

const statusFilter = (calls: Array<[string, unknown[]]>) => calls.find(([m, args]) => m === "in" && args[0] === "status");

beforeEach(() => vi.clearAllMocks());

describe("eventDao.list draft visibility", () => {
  // Only admins may create a draft (`POST /api/events` requires admin), so a
  // literal `role !== "facilitator"` test hid every draft from the one role
  // allowed to make them.
  it.each(["facilitator", "admin", "super_admin"])("does not filter drafts away for %s", async (role) => {
    const { client, calls } = queryStub();

    await eventDao.list(client, { role });

    expect(statusFilter(calls)).toBeUndefined();
  });

  it.each(["attendee", "speaker"])("restricts %s to published events", async (role) => {
    const { client, calls } = queryStub();

    await eventDao.list(client, { role });

    expect(statusFilter(calls)).toEqual(["in", ["status", ["active", "complete"]]]);
  });

  it("restricts a logged-out visitor to published events", async () => {
    const { client, calls } = queryStub();

    await eventDao.list(client, { role: null });

    expect(statusFilter(calls)).toEqual(["in", ["status", ["active", "complete"]]]);
  });

  it("restricts an unrecognised role to published events", async () => {
    const { client, calls } = queryStub();

    await eventDao.list(client, { role: "not_a_role" });

    expect(statusFilter(calls)).toEqual(["in", ["status", ["active", "complete"]]]);
  });
});
