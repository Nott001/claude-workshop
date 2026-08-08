import { isEventFinished } from "@/shared/lib/date-utils";
import type { Event } from "@/shared/types";

export interface PageOptions {
  page?: number;
  limit?: number;
}

export const DEFAULT_PAGE_LIMIT = 50;

/**
 * The inclusive range and the clamped page/limit for an offset-paginated list.
 * Shared so every list DAO bounds the same way instead of each inventing its own
 * floor and ceiling.
 */
export function pageBounds(options?: PageOptions): { from: number; to: number; page: number; limit: number } {
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.max(1, Math.min(options?.limit ?? DEFAULT_PAGE_LIMIT, 100));
  const from = (page - 1) * limit;
  return { from, to: from + limit - 1, page, limit };
}

/**
 * A read whose query failed throws here instead of returning `null`, so the
 * caller can tell "no row" from "the database is down". `null` is reserved for
 * a clean miss.
 */
export function throwOnDbError(error: { message: string; code?: string } | null, context: string): void {
  if (error) {
    throw new Error(`${context} failed: ${error.message}${error.code ? ` (${error.code})` : ""}`);
  }
}

// The status column is only ever advanced to "active" by the publish flow, so a
// past event lingers there forever and the UI has to lie about it. Every read
// path that surfaces status derives the effective value instead: once an
// active event's end time has passed it is served as complete.
export function effectiveEventStatus(event: Pick<Event, "event_date" | "start_time" | "end_time" | "status">): Event["status"] {
  if (event.status === "active" && isEventFinished(event.event_date, event.end_time)) {
    return "complete";
  }
  return event.status;
}

/**
 * Escapes a value interpolated into a PostgREST `or(...)` filter so a `,`, `(`
 * or `"` in user input cannot split the filter into conditions it was not
 * asked for. `ilikePattern` is the variant for `ilike` searches, which also
 * neutralise `%`/`_`; `eq`/`neq` values are matched literally, so those two
 * wildcards are left alone here.
 */
export function escapeOrValue(value: string | number): string {
  return String(value).replace(/[,()"\\]/g, (char) => `\\${char}`);
}

/**
 * The cursor page every message feed uses: fetch one row more than the limit to
 * learn whether another page exists, hand the page back in reading order, and
 * report a cursor only when there is more. The caller builds the base query
 * (select, filters, ordering-neutral constraints); this helper applies the
 * before/after/limit tail.
 */
export interface CursorQuery {
  gt(column: string, value: string): CursorQuery;
  lt(column: string, value: string): CursorQuery;
  order(column: string, options: { ascending: boolean }): CursorQuery;
  limit(count: number): CursorQuery;
  // PostgREST builders resolve as PromiseLike, not Promise; matching that keeps
  // the interface structurally compatible with the generated client.
  then<TResult = { data: unknown[] | null }>(
    onfulfilled?: ((value: { data: unknown[] | null }) => TResult | PromiseLike<TResult>) | null,
    onrejected?: ((reason: unknown) => TResult | PromiseLike<TResult>) | null,
  ): PromiseLike<TResult>;
}

export interface CursorFeedOptions {
  before?: string | null;
  after?: string | null;
  limit: number;
}

export async function runCursorFeed<T>(
  query: CursorQuery,
  cursorField: string,
  options: CursorFeedOptions,
): Promise<{ data: T[]; nextCursor: string | null }> {
  const { before, after, limit } = options;

  if (after) {
    query = query.gt(cursorField, after).order(cursorField, { ascending: true });
  } else {
    query = query.order(cursorField, { ascending: false });
  }

  if (before) {
    query = query.lt(cursorField, before);
  }

  const { data } = await query.limit(limit + 1);

  const rows = (data ?? []) as T[];
  const hasMore = rows.length > limit;
  const result = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore && result.length > 0 ? (result[result.length - 1] as Record<string, unknown>)[cursorField] : null;

  if (!after) result.reverse();

  return { data: result, nextCursor: (nextCursor as string | null) ?? null };
}

/**
 * Wraps a user-supplied term as a quoted `ilike` pattern.
 *
 * PostgREST delimits `or=(…)` with commas and parentheses and reads `%` and `_`
 * as wildcards, so interpolating a term raw lets the input rewrite the filter
 * rather than be matched by it. Quoting keeps delimiters literal; escaping keeps
 * an underscore in an email address from matching any character.
 */
export function ilikePattern(search: string): string {
  const escaped = search.replace(/[\\%_"]/g, (char) => `\\${char}`);
  return `"%${escaped}%"`;
}
