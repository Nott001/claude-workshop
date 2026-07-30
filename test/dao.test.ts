import { describe, it, expect, vi, beforeEach } from "vitest";
import { findById, exists, findByField, deleteById, ilikePattern } from "@/shared/db/dao/helpers";
import { ticketDao } from "@/shared/db/dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * Records the query the DAO builds so tests can assert on the filters applied.
 * Every chainable method returns the same object; the terminal call resolves.
 */
function queryStub(result: { data?: unknown; error?: unknown; count?: number } = {}) {
  const calls: Array<[string, unknown[]]> = [];
  const chain: Record<string, unknown> = {};

  for (const method of ["select", "eq", "neq", "in", "or", "update", "delete", "limit", "range", "order", "insert"]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      calls.push([method, args]);
      return chain;
    });
  }
  const settled = { data: result.data ?? null, error: result.error ?? null, count: result.count ?? null };
  chain.single = vi.fn(() => Promise.resolve(settled));
  chain.then = (resolve: (v: unknown) => unknown) => resolve(settled);

  const from = vi.fn(() => chain);
  return { client: { from } as unknown as DbClient, from, chain, calls };
}

const filters = (calls: Array<[string, unknown[]]>) => calls.filter(([m]) => m === "eq" || m === "neq");

beforeEach(() => vi.clearAllMocks());

describe("helpers.findById", () => {
  it("filters the named table by id", async () => {
    const { client, from, calls } = queryStub({ data: { id: 3 } });

    await findById(client, "EVENT", 3);

    expect(from).toHaveBeenCalledWith("EVENT");
    expect(filters(calls)).toEqual([["eq", ["id", 3]]]);
  });

  it("returns null rather than undefined when the row is absent", async () => {
    const { client } = queryStub({ data: null });
    await expect(findById(client, "EVENT", 3)).resolves.toBeNull();
  });
});

describe("helpers.findByField", () => {
  it("filters by the field it is given", async () => {
    const { client, calls } = queryStub({ data: { id: 1 } });

    await findByField(client, "USER", "email", "jane@example.com");

    expect(filters(calls)).toEqual([["eq", ["email", "jane@example.com"]]]);
  });

  it("selects everything by default and honours a narrower projection", async () => {
    const a = queryStub({ data: {} });
    await findByField(a.client, "USER", "email", "x");
    expect(a.chain.select).toHaveBeenCalledWith("*");

    const b = queryStub({ data: {} });
    await findByField(b.client, "USER", "email", "x", "id, email");
    expect(b.chain.select).toHaveBeenCalledWith("id, email");
  });
});

describe("helpers.exists / deleteById", () => {
  it("reports existence as a boolean", async () => {
    await expect(exists(queryStub({ data: { id: 1 } }).client, "EVENT", 1)).resolves.toBe(true);
    await expect(exists(queryStub({ data: null }).client, "EVENT", 1)).resolves.toBe(false);
  });

  it("reports a failed delete as false instead of throwing", async () => {
    await expect(deleteById(queryStub({ error: null }).client, "EVENT", 1)).resolves.toBe(true);
    await expect(deleteById(queryStub({ error: { message: "fk violation" } }).client, "EVENT", 1)).resolves.toBe(false);
  });
});

describe("ticketDao.findActiveByUserAndEvent", () => {
  it("scopes to both the user and the event, and excludes cancelled tickets", async () => {
    const { client, from, calls } = queryStub({ data: [] });

    await ticketDao.findActiveByUserAndEvent(client, 5, 10);

    expect(from).toHaveBeenCalledWith("TICKET");
    // Dropping either eq would let one user see another's tickets.
    expect(filters(calls)).toEqual([
      ["eq", ["user_id", 5]],
      ["eq", ["event_id", 10]],
      ["neq", ["status", "cancelled"]],
    ]);
  });

  it("returns an empty array when the query yields nothing", async () => {
    const { client } = queryStub({ data: null });
    await expect(ticketDao.findActiveByUserAndEvent(client, 5, 10)).resolves.toEqual([]);
  });
});

describe("ticketDao.findByQrToken", () => {
  it("looks the ticket up by token alone", async () => {
    const { client, calls } = queryStub({ data: { payment_id: 1 } });

    await ticketDao.findByQrToken(client, "tok_abc");

    expect(filters(calls)).toEqual([["eq", ["qr_token", "tok_abc"]]]);
  });
});

describe("ticketDao.updateStatus", () => {
  it("records who performed a check-in", async () => {
    const { client, chain, calls } = queryStub({ error: null });

    const ok = await ticketDao.updateStatus(client, 100, "checked_in", 7);

    expect(ok).toBe(true);
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: "checked_in", checked_in_by: 7 }));
    expect(filters(calls)).toEqual([["eq", ["payment_id", 100]]]);
  });

  it("omits checked_in_by entirely when no actor is supplied", async () => {
    const { client, chain } = queryStub({ error: null });

    await ticketDao.updateStatus(client, 100, "cancelled");

    expect(chain.update).toHaveBeenCalledWith(expect.not.objectContaining({ checked_in_by: expect.anything() }));
  });

  it("stamps updated_at on every write", async () => {
    const { client, chain } = queryStub({ error: null });

    await ticketDao.updateStatus(client, 100, "cancelled");

    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ updated_at: expect.any(String) }));
  });

  it("reports a failed write as false so callers do not report success", async () => {
    const { client } = queryStub({ error: { message: "conflict" } });
    await expect(ticketDao.updateStatus(client, 100, "checked_in", 7)).resolves.toBe(false);
  });
});

describe("helpers.ilikePattern", () => {
  it("surrounds the term with wildcards so it matches anywhere in the value", () => {
    expect(ilikePattern("jane")).toBe('"%jane%"');
  });

  it("quotes the term so a comma cannot split the filter it sits in", () => {
    // Unquoted, "a,b" would read as two separate conditions to PostgREST.
    expect(ilikePattern("a,b")).toBe('"%a,b%"');
  });

  it("escapes wildcards so an email underscore matches literally", () => {
    expect(ilikePattern("john_doe")).toBe('"%john\\_doe%"');
    expect(ilikePattern("50%")).toBe('"%50\\%%"');
  });

  it("escapes quotes so the term cannot close its own quoting", () => {
    expect(ilikePattern('a"b')).toBe('"%a\\"b%"');
  });
});

describe("ticketDao.getAttendees", () => {
  const options = { page: 1, limit: 20 };

  it("scopes to the event and pages the result", async () => {
    const { client, from, calls, chain } = queryStub({ data: [], count: 0 });

    await ticketDao.getAttendees(client, 42, options);

    expect(from).toHaveBeenCalledWith("TICKET");
    expect(filters(calls)).toEqual([["eq", ["event_id", 42]]]);
    expect(chain.range).toHaveBeenCalledWith(0, 19);
  });

  it("joins the user inline so the search can filter on it", async () => {
    const { client, chain } = queryStub({ data: [], count: 0 });

    await ticketDao.getAttendees(client, 42, { ...options, search: "jane" });

    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining("USER:user_id!inner"), { count: "exact" });
  });

  it("searches name and email against the embedded user, not the ticket", async () => {
    const { client, chain } = queryStub({ data: [], count: 0 });

    await ticketDao.getAttendees(client, 42, { ...options, search: "jane" });

    // Columns must be unprefixed and scoped by referencedTable: a top-level
    // `USER.full_name` filter is not something PostgREST will apply.
    expect(chain.or).toHaveBeenCalledWith('full_name.ilike."%jane%",email.ilike."%jane%"', { referencedTable: "USER" });
  });

  it("does not filter at all when no search term is given", async () => {
    const { client, chain } = queryStub({ data: [], count: 0 });

    await ticketDao.getAttendees(client, 42, options);

    expect(chain.or).not.toHaveBeenCalled();
  });

  it("passes a search term through the escaping helper", async () => {
    const { client, chain } = queryStub({ data: [], count: 0 });

    await ticketDao.getAttendees(client, 42, { ...options, search: "a,b" });

    expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('"%a,b%"'), { referencedTable: "USER" });
  });

  it("narrows by check-in status when asked", async () => {
    const checked = queryStub({ data: [], count: 0 });
    await ticketDao.getAttendees(checked.client, 42, { ...options, status: "checked_in" });
    expect(filters(checked.calls)).toEqual([
      ["eq", ["event_id", 42]],
      ["eq", ["status", "checked_in"]],
    ]);

    const pending = queryStub({ data: [], count: 0 });
    await ticketDao.getAttendees(pending.client, 42, { ...options, status: "not_checked_in" });
    expect(pending.chain.in).toHaveBeenCalledWith("status", ["issued"]);
  });

  it("flattens a to-one embed that arrives as an array", async () => {
    const { client } = queryStub({
      data: [{ USER: [{ id: 1, full_name: "Jane", email: "jane@example.com" }], status: "issued" }],
      count: 1,
    });

    const { data, total } = await ticketDao.getAttendees(client, 42, options);

    expect(data[0].USER).toEqual({ id: 1, full_name: "Jane", email: "jane@example.com" });
    expect(total).toBe(1);
  });

  it("reports a total of zero rather than null when the count is missing", async () => {
    const { client } = queryStub({ data: [] });
    await expect(ticketDao.getAttendees(client, 42, options)).resolves.toEqual({ data: [], total: 0 });
  });
});
