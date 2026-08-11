import { describe, it, expect, vi } from "vitest";
import * as eventDao from "@/modules/events/db/event.dao";
import type { DbClient } from "@/shared/db/dao/types";

type Call = [string, unknown[]];

function chainStub(result: unknown) {
  const calls: Call[] = [];
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "neq", "order", "range"]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    });
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { chain, calls };
}

const clientWith = (rows: unknown[]): { client: DbClient; calls: Call[] } => {
  const { chain, calls } = chainStub({ data: rows, error: null });
  return { client: { from: vi.fn(() => chain) } as unknown as DbClient, calls };
};

describe("eventDao.getAttendeeCounts", () => {
  it("builds one select over the given events, excluding cancelled tickets", async () => {
    const { client, calls } = clientWith([{ event_id: 1 }]);

    await eventDao.getAttendeeCounts(client, [1, 2]);

    expect(calls).toEqual([
      ["select", ["event_id"]],
      ["in", ["event_id", [1, 2]]],
      ["neq", ["status", "cancelled"]],
    ]);
  });

  it("tallies the returned rows per event", async () => {
    const { client } = clientWith([{ event_id: 1 }, { event_id: 1 }, { event_id: 2 }]);

    expect(await eventDao.getAttendeeCounts(client, [1, 2])).toEqual({ 1: 2, 2: 1 });
  });

  it("returns {} for an empty id set without querying", async () => {
    const { client } = clientWith([]);

    expect(await eventDao.getAttendeeCounts(client, [])).toEqual({});
    expect(client.from).not.toHaveBeenCalled();
  });
});
