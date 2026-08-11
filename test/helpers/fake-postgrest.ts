/**
 * A PostgREST builder that answers with fixed rows and remembers the selects it
 * was handed.
 *
 * DAO tests care about the query that goes out, not about Supabase's client:
 * an embed silently dropped from a select is invisible to a fixture, and is
 * exactly the kind of drift that has broken this project's list endpoints
 * before. Recording the select string is what makes that assertable.
 */
export interface FakePostgrest {
  /** Passes as the `DbClient` the DAOs accept. */
  client: never;
  /** Every select string the call made, in order. */
  selects: string[];
  /** Every update payload the call made, in order. */
  updates: unknown[];
}

export function fakePostgrest(data: unknown): FakePostgrest {
  const selects: string[] = [];
  const updates: unknown[] = [];
  const result = { data };

  const builder: Record<string, unknown> = {
    // Any terminal — `.order()`, `.range()`, `.single()`, a bare await on the
    // chain — resolves to the fixed `{ data }`. DAOs now range-limit every
    // listing, so no single method can claim to be the only terminal.
    then: (resolve: (v: unknown) => unknown) => resolve(result),
    select(columns: string) {
      selects.push(columns);
      return builder;
    },
    update(columns: unknown) {
      updates.push(columns);
      return builder;
    },
  };

  for (const method of ["eq", "neq", "in", "is", "gte", "lt", "or", "order", "limit", "range", "single", "maybeSingle"]) {
    builder[method] = () => builder;
  }

  return { client: { from: () => builder } as never, selects, updates };
}
