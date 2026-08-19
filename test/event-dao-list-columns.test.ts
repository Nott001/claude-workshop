import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi } from "vitest";
import * as eventDao from "@/modules/events/db/event.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * The listing is the widest read in the app and feeds the public event list,
 * so what it selects is a security boundary as much as a performance one.
 * These pin the column set: `meeting_url` must not come back, and the columns
 * the cards and the staff table render must.
 */

function clientCapturingFilters(): { client: DbClient; calls: Record<string, unknown[][]> } {
  const calls: Record<string, unknown[][]> = {};
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "or", "gte", "lt", "order", "limit", "range"]) {
    chain[method] = vi.fn((...args: unknown[]) => {
      (calls[method] ??= []).push(args);
      return chain;
    });
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], count: 0, error: null });
  return { client: { from: vi.fn(() => chain) } as unknown as DbClient, calls };
}

function clientCapturingSelect(): { client: DbClient; selected: () => string } {
  let captured = "";
  const chain: Record<string, unknown> = {};
  for (const method of ["eq", "in", "or", "gte", "lt", "order", "limit", "range"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.select = vi.fn((columns: string) => {
    captured = columns;
    return chain;
  });
  chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], count: 0, error: null });

  return {
    client: { from: vi.fn(() => chain) } as unknown as DbClient,
    selected: () => captured,
  };
}

describe("eventDao.list column selection", () => {
  it("never returns the meeting link to a listing caller", async () => {
    const { client, selected } = clientCapturingSelect();

    await eventDao.list(client, { role: ROLES.ADMIN });

    expect(selected()).not.toContain("meeting_url");
  });

  it("asks for named columns rather than the whole row", async () => {
    const { client, selected } = clientCapturingSelect();

    await eventDao.list(client, { role: ROLES.ATTENDEE });

    expect(selected()).not.toContain("*");
    // The columns the listing discarded: fetching them cost a serialise on the
    // way out and a parse on the way back in, for data nothing rendered.
    for (const dropped of ["description", "price", "currency", "survey_enabled", "created_at"]) {
      expect(selected()).not.toContain(dropped);
    }
  });

  it("asks for every column the cards and the staff table render", async () => {
    const { client, selected } = clientCapturingSelect();

    await eventDao.list(client, { role: ROLES.ADMIN });

    const columns = selected();
    for (const needed of [
      "id",
      "title",
      "event_date",
      "start_time",
      "end_time",
      "venue_name",
      "venue_address",
      "status",
      "event_type",
      "cover_image_url",
      // Drives the staff table's "12 / 50" attendance cell.
      "capacity",
    ]) {
      expect(columns).toContain(needed);
    }
    // The course name arrives through the embed, not as a column.
    expect(columns).toContain("COURSE!event_id(course_name)");
  });
});

/**
 * The listing's tabs were a client-side filter over one unscoped page, so a tab
 * showed only the events of its kind that fell in the fifty rows fetched. The
 * status set is how a tab now scopes its own query.
 */
describe("eventDao.list status scoping", () => {
  it("narrows to the statuses a listing asked for", async () => {
    const { client, calls } = clientCapturingFilters();

    await eventDao.list(client, { role: ROLES.ADMIN, statuses: ["active", "draft"] });

    expect(calls.in).toContainEqual(["status", ["active", "draft"]]);
  });

  it("cannot widen what the role guard already allows", async () => {
    const { client, calls } = clientCapturingFilters();

    // An attendee asking for drafts: the guard pins the set to active/complete
    // first, so this narrows an already-draftless query to nothing.
    await eventDao.list(client, { role: ROLES.ATTENDEE, statuses: ["draft"] });

    expect(calls.in?.[0]).toEqual(["status", ["active", "complete"]]);
    expect(calls.in?.[1]).toEqual(["status", ["draft"]]);
  });

  it("leaves the status column alone when no set is given", async () => {
    const { client, calls } = clientCapturingFilters();

    await eventDao.list(client, { role: ROLES.ADMIN });

    expect(calls.in ?? []).not.toContainEqual(["status", []]);
    expect((calls.in ?? []).length).toBe(0);
  });
});
