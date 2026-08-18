import { describe, it, expect, vi } from "vitest";
import type { DbClient } from "@/shared/db/dao/types";
import { deleteByIds } from "@/modules/courses/qa/db/qa-message.dao";

function stub(result: { data?: unknown; error?: unknown } = { data: [] }) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {
    then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  for (const method of ["delete", "in"]) {
    chain[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    };
  }
  return { client: { from: vi.fn(() => chain) } as unknown as DbClient, calls };
}

const argsOf = (calls: Array<[string, unknown[]]>, method: string) => calls.find(([m]) => m === method)?.[1];

describe("qa-message.dao.deleteByIds", () => {
  it("issues a real DELETE for the given ids on QA_MESSAGE", async () => {
    const { client, calls } = stub({ error: null });

    await expect(deleteByIds(client, [42])).resolves.toBe(true);

    expect((client.from as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("QA_MESSAGE");
    expect(calls.some(([m]) => m === "delete")).toBe(true);
    expect(argsOf(calls, "in")).toEqual(["id", [42]]);
  });

  it("removes every id in a single statement", async () => {
    const { client, calls } = stub({ error: null });

    await deleteByIds(client, [7, 8, 9]);

    expect(argsOf(calls, "in")).toEqual(["id", [7, 8, 9]]);
  });

  it("returns false when the delete reports an error", async () => {
    const { client } = stub({ error: { message: "delete blocked" } });

    await expect(deleteByIds(client, [42])).resolves.toBe(false);
  });
});
