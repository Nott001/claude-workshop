import { describe, it, expect, vi } from "vitest";
import * as emailDao from "@/shared/db/dao/email.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * Searching the recipient is two queries because the recipient is an embedded
 * USER row, which PostgREST cannot filter directly. The first resolves matching
 * user ids; the second narrows EMAIL_LOG with an `in`. A match that nobody
 * satisfies must fall back to the `[-1]` sentinel so the result set is empty
 * instead of matching every row.
 */

function userChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "or", "in"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

function logChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "order", "eq", "in", "range"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

describe("email.dao list search", () => {
  it("quoted or() against USER, then narrows the log query with the resolved ids", async () => {
    const users = userChain({ data: [{ id: 7 }, { id: 9 }], error: null });
    const logs = logChain({ data: [], error: null, count: 0 });
    const client = {
      from: vi.fn((table: string) => (table === "USER" ? users : logs)),
    } as unknown as DbClient;

    await emailDao.list(client, { page: 1, limit: 50, search: "ada lovelace" });

    expect(users.select).toHaveBeenCalledWith("id");
    expect(users.or).toHaveBeenCalledWith(`full_name.ilike."%ada lovelace%",email.ilike."%ada lovelace%"`);
    expect(logs.in).toHaveBeenCalledWith("user_id", [7, 9]);
  });

  it("escapes wildcard characters in the search term", async () => {
    const users = userChain({ data: [], error: null });
    const logs = logChain({ data: [], error: null, count: 0 });
    const client = {
      from: vi.fn((table: string) => (table === "USER" ? users : logs)),
    } as unknown as DbClient;

    await emailDao.list(client, { page: 1, limit: 50, search: "50%_off" });

    expect(users.or).toHaveBeenCalledWith(`full_name.ilike."%50\\%\\_off%",email.ilike."%50\\%\\_off%"`);
  });

  it("guards an empty id list with [-1] so nothing matches instead of all rows", async () => {
    const users = userChain({ data: [], error: null });
    const logs = logChain({ data: [], error: null, count: 0 });
    const client = {
      from: vi.fn((table: string) => (table === "USER" ? users : logs)),
    } as unknown as DbClient;

    await emailDao.list(client, { page: 1, limit: 50, search: "nobody" });

    expect(logs.in).toHaveBeenCalledWith("user_id", [-1]);
  });

  it("keeps the explicit user_id filter and skips the search lookup when search is empty", async () => {
    const logs = logChain({ data: [], error: null, count: 0 });
    const client = {
      from: vi.fn((table: string) => (table === "USER" ? {} : logs)),
    } as unknown as DbClient;

    await emailDao.list(client, { page: 1, limit: 50, user_id: "3" });

    expect(logs.eq).toHaveBeenCalledWith("user_id", "3");
    expect(logs.in).not.toHaveBeenCalled();
  });
});
