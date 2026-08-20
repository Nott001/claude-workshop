import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { getSetting, setSetting } from "@/shared/db/dao/system-setting.dao";
import { listEventWindowsByUser } from "@/shared/db/dao/ticket.dao";
import { listCourseSummaries, listModulesByEvent } from "@/shared/db/dao/course.dao";
import type { DbClient } from "@/shared/db/dao/types";

/** The chainable stub the other DAO suites use, narrowed to one table. */
function stub(result: { data?: unknown; error?: unknown }) {
  const calls: Array<[string, unknown[]]> = [];

  const chain: Record<string, unknown> = {
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ["select", "eq", "in", "neq", "order", "upsert"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }

  const from = vi.fn(() => chain);
  return { client: { from } as unknown as DbClient, calls, from };
}

const argsOf = (calls: Array<[string, unknown[]]>, method: string) => calls.find(([m]) => m === method)?.[1];

const schema = z.object({ enabled: z.boolean() });

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("system-setting.dao", () => {
  it("returns the stored value when it parses", async () => {
    const { client } = stub({ data: { setting_value: { enabled: true } }, error: null });

    await expect(getSetting(client, "flag", schema, { enabled: false })).resolves.toEqual({ enabled: true });
  });

  it("falls back for a missing row", async () => {
    const { client } = stub({ data: null, error: null });

    await expect(getSetting(client, "flag", schema, { enabled: false })).resolves.toEqual({ enabled: false });
  });

  it("falls back rather than handing a gate a shape it never checked", async () => {
    // The row is edited by hand in the dashboard, so this is the realistic
    // failure — and the value it feeds decides access.
    const { client } = stub({ data: { setting_value: { enabled: "yes" } }, error: null });

    await expect(getSetting(client, "flag", schema, { enabled: false })).resolves.toEqual({ enabled: false });
  });

  it("writes the key, the value and who changed it", async () => {
    const { client, calls } = stub({ error: null });

    await expect(setSetting(client, "flag", { enabled: true }, 7)).resolves.toBe(true);
    expect(argsOf(calls, "upsert")?.[0]).toMatchObject({
      setting_key: "flag",
      setting_value: { enabled: true },
      updated_by: 7,
    });
  });

  it("reports a refused write instead of claiming it landed", async () => {
    const { client } = stub({ error: { message: "denied", code: "42501" } });

    await expect(setSetting(client, "flag", {}, 7)).resolves.toBe(false);
  });
});

describe("ticket.dao.listEventWindowsByUser", () => {
  it("returns the embedded event windows", async () => {
    const { client, calls } = stub({
      data: [{ EVENT: { id: 12, event_date: "2026-08-18", end_time: "17:00" } }],
      error: null,
    });

    await expect(listEventWindowsByUser(client, 5, [12, 13])).resolves.toEqual([
      { id: 12, event_date: "2026-08-18", end_time: "17:00" },
    ]);
    expect(argsOf(calls, "in")).toEqual(["event_id", [12, 13]]);
    // A cancelled ticket is not attendance, so it cannot unlock anything.
    expect(argsOf(calls, "neq")).toEqual(["status", "cancelled"]);
  });

  it("asks nothing of the database when no event could unlock the course", async () => {
    const { client, from } = stub({ data: [], error: null });

    await expect(listEventWindowsByUser(client, 5, [])).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });

  it("drops a row whose event embed came back empty", async () => {
    const { client } = stub({ data: [{ EVENT: null }], error: null });

    await expect(listEventWindowsByUser(client, 5, [12])).resolves.toEqual([]);
  });
});

describe("course.dao.listCourseSummaries", () => {
  it("filters to the ids it was given", async () => {
    const { client, calls } = stub({ data: [{ id: 4 }], error: null });

    await expect(listCourseSummaries(client, { ids: [4] })).resolves.toEqual([{ id: 4 }]);
    expect(argsOf(calls, "in")).toEqual(["id", [4]]);
  });

  it("filters to the events it was given", async () => {
    const { client, calls } = stub({ data: [{ id: 4 }], error: null });

    await expect(listCourseSummaries(client, { eventIds: [12] })).resolves.toEqual([{ id: 4 }]);
    expect(argsOf(calls, "in")).toEqual(["event_id", [12]]);
  });

  it("lists every course when given no filter", async () => {
    const { client, calls } = stub({ data: [{ id: 4 }, { id: 7 }], error: null });

    await expect(listCourseSummaries(client)).resolves.toHaveLength(2);
    expect(argsOf(calls, "in")).toBeUndefined();
  });

  it.each([{ ids: [] }, { eventIds: [] }])("short-circuits the empty filter %j, the released-nothing case", async (options) => {
    const { client, from } = stub({ data: [], error: null });

    await expect(listCourseSummaries(client, options)).resolves.toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("course.dao.listModulesByEvent", () => {
  it("reaches the modules through the course the event owns", async () => {
    const { client, calls } = stub({
      data: [{ id: 4, module_name: "Deep dive", module_type: "lessons", sequence_order: 1, COURSE: { event_id: 12 } }],
      error: null,
    });

    // The join key is dropped: the picker renders modules, and leaving the
    // embed on the row would put it in the response for nobody to read.
    await expect(listModulesByEvent(client, 12)).resolves.toEqual([
      { id: 4, module_name: "Deep dive", module_type: "lessons", sequence_order: 1 },
    ]);
    expect(argsOf(calls, "eq")).toEqual(["COURSE.event_id", 12]);
    expect(argsOf(calls, "order")).toEqual(["sequence_order", { ascending: true }]);
  });

  it("returns nothing for an event whose course has no modules", async () => {
    const { client } = stub({ data: [], error: null });

    await expect(listModulesByEvent(client, 12)).resolves.toEqual([]);
  });
});
