import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, beforeEach } from "vitest";
import * as eventDao from "@/modules/events/db/event.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * Mirrors the query stub in dao.test.ts: every chainable method records its
 * arguments and returns the same object, so a test can assert on the filters
 * the DAO applied without a database.
 */
function queryStub(result: { data?: unknown } = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};

  for (const method of ["select", "eq", "in", "gte", "lt", "order", "limit", "range"]) {
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
  // literal `role !== ROLES.FACILITATOR` test hid every draft from the one role
  // allowed to make them.
  it.each([ROLES.FACILITATOR, ROLES.ADMIN, ROLES.SUPER_ADMIN])("does not filter drafts away for %s", async (role) => {
    const { client, calls } = queryStub();

    await eventDao.list(client, { role });

    expect(statusFilter(calls)).toBeUndefined();
  });

  it.each([ROLES.ATTENDEE, ROLES.SPEAKER])("restricts %s to published events", async (role) => {
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

describe("eventDao.list facilitator visibility", () => {
  /** EVENT and EVENT_FACILITATOR need separate settled values per table. */
  function listStub(assignedEventIds: number[] = []) {
    const calls: Array<[string, unknown[]]> = [];
    const eventChain: Record<string, unknown> = {};
    for (const method of ["select", "eq", "in", "gte", "lt", "order", "limit", "range"]) {
      eventChain[method] = vi.fn((...args: unknown[]) => {
        calls.push([method, args]);
        return eventChain;
      });
    }
    eventChain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null });

    const efChain: Record<string, unknown> = {};
    for (const method of ["select", "eq"]) {
      efChain[method] = vi.fn((...args: unknown[]) => {
        calls.push([method, args]);
        return efChain;
      });
    }
    efChain.then = (resolve: (v: unknown) => unknown) =>
      resolve({ data: assignedEventIds.map((event_id) => ({ event_id })), error: null });

    const from = vi.fn((table: string) => (table === "EVENT_FACILITATOR" ? efChain : eventChain));
    return { client: { from } as unknown as DbClient, calls };
  }

  it("limits a facilitator to the events assigned to them", async () => {
    const { client, calls } = listStub([41, 42]);

    await eventDao.list(client, { role: ROLES.FACILITATOR, userId: 3 });

    expect(calls).toContainEqual(["select", ["event_id"]]);
    expect(calls).toContainEqual(["eq", ["user_id", 3]]);
    expect(calls).toContainEqual(["in", ["id", [41, 42]]]);
  });

  it("lists nothing for a facilitator with no assignments", async () => {
    const { client, calls } = listStub([]);

    await eventDao.list(client, { role: ROLES.FACILITATOR, userId: 3 });

    // An empty in() is vacuous to PostgREST, so the sentinel id is what
    // actually guarantees an empty list.
    expect(calls).toContainEqual(["in", ["id", [-1]]]);
  });

  it.each([ROLES.ADMIN, ROLES.SUPER_ADMIN])("does not restrict %s to their own events", async (role) => {
    const { client, calls } = listStub();

    await eventDao.list(client, { role, userId: 3 });

    expect(calls).not.toContainEqual(["select", ["event_id"]]);
  });

  it("never consults assignments for non-facilitator roles", async () => {
    const { client, calls } = listStub();

    await eventDao.list(client, { role: ROLES.ATTENDEE, userId: 3 });

    expect(calls).not.toContainEqual(["select", ["event_id"]]);
  });
});
