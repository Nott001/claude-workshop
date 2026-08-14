import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi } from "vitest";
import * as eventDao from "@/modules/events/db/event.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * Title/venue search must reach PostgREST as a quoted, escaped `or(...)` filter
 * so a comma, paren, percent or underscore in the term cannot rewrite it.
 */

function chainStub(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "or", "gte", "lt", "order", "limit", "range", "single", "maybeSingle"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

describe("event.dao list search", () => {
  it("applies a quoted ilike or() over title and venue when search is set", async () => {
    const chain = chainStub({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.list(client, { role: ROLES.ATTENDEE, search: "COBOL" });

    expect(chain.or).toHaveBeenCalledWith(`title.ilike."%COBOL%",venue_name.ilike."%COBOL%"`);
  });

  it("escapes wildcard characters in the search term", async () => {
    const chain = chainStub({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.list(client, { role: ROLES.ATTENDEE, search: "50%_off" });

    expect(chain.or).toHaveBeenCalledWith(`title.ilike."%50\\%\\_off%",venue_name.ilike."%50\\%\\_off%"`);
  });

  it("omits the or() filter when search is empty", async () => {
    const chain = chainStub({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.list(client, { role: ROLES.ATTENDEE, search: "" });

    expect(chain.or).not.toHaveBeenCalled();
  });

  // Search and the archive ordering were added on separate branches and now
  // share one chain. Asserting only that both were called would not catch the
  // resolution that matters: search has to reach PostgREST before the range
  // bounds, or staff would be searching the fetched page rather than the whole
  // event set — and every other assertion in this file still passes if it does.
  it("applies the search filter before the range bounds", async () => {
    const chain = chainStub({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.list(client, { role: ROLES.ATTENDEE, search: "COBOL" });

    const searchCall = (chain.or as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    const rangeCall = (chain.range as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0];
    expect(searchCall).toBeLessThan(rangeCall);
  });

  it("keeps the newest-first archive ordering when a past listing is searched", async () => {
    const chain = chainStub({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.list(client, { role: ROLES.ATTENDEE, filter: "past", search: "COBOL" });

    expect(chain.or).toHaveBeenCalledWith(`title.ilike."%COBOL%",venue_name.ilike."%COBOL%"`);
    expect(chain.order).toHaveBeenCalledWith("event_date", { ascending: false });
  });
});
