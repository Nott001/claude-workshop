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
}

export function fakePostgrest(data: unknown): FakePostgrest {
  const selects: string[] = [];
  const result = { data };

  const builder = {
    select(columns: string) {
      selects.push(columns);
      return builder;
    },
    eq: () => builder,
    // Both terminals answer the same way; `await` on a plain object is fine, so
    // a DAO ending in either `.order()` or `.single()` reads this identically.
    order: () => result,
    single: () => result,
  };

  return { client: { from: () => builder } as never, selects };
}
