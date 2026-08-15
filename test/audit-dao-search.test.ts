import { describe, it, expect, vi } from "vitest";
import * as auditDao from "@/modules/audit/db/audit.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * Search must reach PostgREST as a quoted, escaped `or(...)` filter and only
 * turn the ACTOR embed inner when a term is present — an unconditional inner
 * join would drop every row whose actor is missing.
 */

function chainStub(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "or", "order", "limit", "range", "single", "maybeSingle"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

describe("audit.dao list search", () => {
  it("builds the search or() across action, entity and actor when search is set", async () => {
    const chain = chainStub({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await auditDao.list(client, { page: 1, limit: 20, search: "event" });

    expect(chain.select).toHaveBeenCalledWith("*, ACTOR:actor_id!inner(id, full_name, email)", { count: "exact" });
    expect(chain.or).toHaveBeenCalledWith(
      `action.ilike."%event%",entity_type.ilike."%event%",ACTOR.full_name.ilike."%event%",ACTOR.email.ilike."%event%"`,
    );
  });

  it("escapes wildcard characters in the search term", async () => {
    const chain = chainStub({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await auditDao.list(client, { page: 1, limit: 20, search: "50%_off" });

    expect(chain.or).toHaveBeenCalledWith(
      `action.ilike."%50\\%\\_off%",entity_type.ilike."%50\\%\\_off%",ACTOR.full_name.ilike."%50\\%\\_off%",ACTOR.email.ilike."%50\\%\\_off%"`,
    );
  });

  it("keeps the outer embed join and skips the or() when search is empty", async () => {
    const chain = chainStub({ data: [], error: null, count: 0 });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await auditDao.list(client, { page: 1, limit: 20 });

    expect(chain.select).toHaveBeenCalledWith("*, ACTOR:actor_id(id, full_name, email)", { count: "exact" });
    expect(chain.or).not.toHaveBeenCalled();
  });
});
