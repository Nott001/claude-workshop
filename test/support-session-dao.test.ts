import { describe, it, expect, vi } from "vitest";
import * as dao from "@/shared/db/dao/support-session.dao";
import type { DbClient } from "@/shared/db/dao/types";

function makeChain(result: { data?: unknown; error?: unknown }) {
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
  return { chain: chain as never, calls };
}

function stub(results: Array<{ data?: unknown; error?: unknown }>) {
  const made = results.map((r) => makeChain(r));
  const callsList = made.map((c) => c.calls);
  let i = 0;
  const client = { from: vi.fn(() => made[i++].chain) } as unknown as DbClient;
  return { client, callsList };
}

const argsOf = (calls: Array<[string, unknown[]]>, method: string) => calls.find(([m]) => m === method)?.[1];

describe("support-session.dao ownership", () => {
  it("reads the case number and handler when looking up an active session", async () => {
    const { client, callsList } = stub([{ data: { id: 1, case_number: 100, assigned_to: null } }]);

    await dao.findActiveSession(client, 5, "general");

    expect(argsOf(callsList[0], "select")).toEqual(["id, case_number, assigned_to"]);
    expect(argsOf(callsList[0], "is")).toEqual(["event_id", null]);
  });

  it("claims an active, unclaimed session for the staff member", async () => {
    const { client, callsList } = stub([{ data: { id: 1, case_number: 100, assigned_to: 3 } }]);

    const session = await dao.claimSession(client, 5, "general", 3);

    expect(session).toMatchObject({ id: 1, assigned_to: 3 });
    const [payload] = argsOf(callsList[0], "update") as [Record<string, unknown>];
    expect(payload).toHaveProperty("assigned_to", 3);
    expect(callsList[0].filter(([m, a]) => m === "is" && a[0] === "assigned_to" && a[1] === null)).toHaveLength(1);
  });

  it("reports a claim that could not land as nothing claimed", async () => {
    const { client } = stub([{ data: null, error: { message: "no row", code: "PGRST116" } }]);

    await expect(dao.claimSession(client, 5, "general", 3)).resolves.toBeNull();
  });

  it("clears the handler only when the caller is the current owner", async () => {
    const { client, callsList } = stub([{ data: { id: 1, case_number: 100, assigned_to: null } }]);

    await dao.relinquishSession(client, 5, "general", 3);

    const [payload] = argsOf(callsList[0], "update") as [Record<string, unknown>];
    expect(payload).toHaveProperty("assigned_to", null);
    expect(callsList[0].filter(([m, a]) => m === "eq" && a[0] === "assigned_to")).toEqual([["eq", ["assigned_to", 3]]]);
  });

  it("ends a case only when the given owner holds it", async () => {
    const { client, callsList } = stub([{ data: { id: 1 } }]);

    await dao.endSession(client, 5, "general", undefined, { ownerId: 3 });

    expect(callsList[0].filter(([m, a]) => m === "eq" && a[0] === "assigned_to")).toEqual([["eq", ["assigned_to", 3]]]);
  });

  it("ends an unclaimed case rather than a claimed one", async () => {
    const { client, callsList } = stub([{ data: { id: 1 } }]);

    await dao.endSession(client, 5, "general", undefined, { ownerId: null });

    expect(callsList[0].filter(([m, a]) => m === "is" && a[0] === "assigned_to")).toEqual([["is", ["assigned_to", null]]]);
  });

  it("ends an own session without an ownership constraint", async () => {
    const { client, callsList } = stub([{ data: { id: 1 } }]);

    await dao.endSession(client, 5, "general");

    expect(callsList[0].some(([, a]) => a[0] === "assigned_to")).toBe(false);
  });

  it("purges the ended session instead of marking it ended", async () => {
    const { client, callsList } = stub([{ data: { id: 1 } }]);

    await dao.endSession(client, 5, "general");

    expect(callsList[0].some(([m]) => m === "delete")).toBe(true);
    expect(callsList[0].some(([m]) => m === "update")).toBe(false);
  });
});

describe("support-session.dao listCases", () => {
  it("attaches the latest message and handler name to each open case", async () => {
    const sessions = [
      {
        id: 1,
        case_number: 100,
        user_id: 20,
        assigned_to: 5,
        USER: { full_name: "Ana", role: "attendee" },
        ASSIGNED: { full_name: "Bo" },
      },
      {
        id: 2,
        case_number: 101,
        user_id: 21,
        assigned_to: null,
        USER: { full_name: "Ben", role: "attendee" },
        ASSIGNED: null,
      },
    ];
    const messages = [
      { session_id: 1, message: "later", sent_at: "2026-08-05T11:00:00Z" },
      { session_id: 1, message: "earlier", sent_at: "2026-08-05T10:00:00Z" },
      { session_id: 2, message: "hi", sent_at: "2026-08-05T09:00:00Z" },
    ];
    const { client, callsList } = stub([{ data: sessions }, { data: messages }]);

    const cases = await dao.listCases(client, "general");

    expect(cases[0]).toMatchObject({
      id: 1,
      case_number: 100,
      full_name: "Ana",
      assigned_name: "Bo",
      last_message: "later",
      last_message_at: "2026-08-05T11:00:00Z",
    });
    expect(cases[1]).toMatchObject({ id: 2, case_number: 101, assigned_name: null, last_message: "hi" });

    expect(argsOf(callsList[0], "select")).toEqual(["*, USER:user_id(full_name, role), ASSIGNED:assigned_to(full_name)"]);
    expect(argsOf(callsList[1], "in")).toEqual(["session_id", [1, 2]]);
    expect(callsList[1].filter(([m, a]) => m === "is" && a[0] === "deleted_at" && a[1] === null)).toHaveLength(1);
  });

  it("returns an empty queue when there are no open cases", async () => {
    const { client } = stub([{ data: [] }]);

    await expect(dao.listCases(client, "general")).resolves.toEqual([]);
  });
});
