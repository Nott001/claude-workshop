import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi, afterEach } from "vitest";
import * as eventDao from "@/modules/events/db/event.dao";
import type { DbClient } from "@/shared/db/dao/types";
import { parseEventDateTime } from "@/shared/lib/date-utils";

/**
 * The publish flow only ever moves an event to "active", so a past event never
 * has its status column advanced. These tests pin the read paths' compensation:
 * an active event whose end time has passed is served as complete.
 */

function chainStub(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "or", "gte", "lt", "order", "limit", "range", "single", "maybeSingle"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return chain;
}

const clientWith = (data: unknown): DbClient =>
  ({ from: vi.fn(() => chainStub({ data, error: null })) }) as unknown as DbClient;

const pastActive = { id: 1, status: "active", event_date: "2000-01-01", start_time: "09:00", end_time: "17:00" };
const futureActive = { id: 2, status: "active", event_date: "2099-01-01", start_time: "09:00", end_time: "17:00" };
const pastDraft = { id: 3, status: "draft", event_date: "2000-01-01", start_time: "09:00", end_time: "17:00" };
const pastComplete = { id: 4, status: "complete", event_date: "2000-01-01", start_time: "09:00", end_time: "17:00" };

describe("eventDao effective status", () => {
  it("list serves a past active event as complete", async () => {
    const { data: events } = await eventDao.list(clientWith([pastActive, futureActive, pastDraft, pastComplete]), {
      role: ROLES.ATTENDEE,
    });

    expect(events.map((e) => [e.id, e.status])).toEqual([
      [1, "complete"],
      [2, "active"],
      [3, "draft"],
      [4, "complete"],
    ]);
  });

  it("list keeps a future active event as active", async () => {
    const { data: events } = await eventDao.list(clientWith([futureActive]), { role: ROLES.ATTENDEE });

    expect(events[0].status).toBe("active");
  });

  it("findByIdWithCourse serves a past active event as complete", async () => {
    const event = await eventDao.findByIdWithCourse(clientWith(pastActive), 1);

    expect(event?.status).toBe("complete");
  });

  it("findByIdWithCourse leaves a future active event alone", async () => {
    const event = await eventDao.findByIdWithCourse(clientWith(futureActive), 2);

    expect(event?.status).toBe("active");
  });

  it("findByIdWithCourseName serves a past active event as complete", async () => {
    const event = await eventDao.findByIdWithCourseName(clientWith(pastActive), 1);

    expect(event?.status).toBe("complete");
  });
});

describe("eventDao upcoming filter", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("list with filter=upcoming excludes today's already-finished events via the or() bound", async () => {
    vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);

    const chain = chainStub({ data: [], error: null });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.list(client, { role: ROLES.ATTENDEE, filter: "upcoming" });

    expect(chain.or).toHaveBeenCalledWith(
      expect.stringMatching(/^event_date\.gt\.2026-08-12,and\(event_date\.eq\.2026-08-12,end_time\.gte\.15:00:00\)$/),
    );
  });

  it("list with filter=past includes today's already-finished events via the or() bound", async () => {
    vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);

    const chain = chainStub({ data: [], error: null });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.list(client, { role: ROLES.ATTENDEE, filter: "past" });

    expect(chain.or).toHaveBeenCalledWith(
      expect.stringMatching(/^event_date\.lt\.2026-08-12,and\(event_date\.eq\.2026-08-12,end_time\.lt\.15:00:00\)$/),
    );
  });

  it("list orders past events newest first and every other listing oldest first", async () => {
    const chain = chainStub({ data: [], error: null });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.list(client, { role: ROLES.ATTENDEE, filter: "past" });
    expect(chain.order).toHaveBeenCalledWith("event_date", { ascending: false });

    await eventDao.list(client, { role: ROLES.ATTENDEE, filter: "upcoming" });
    expect(chain.order).toHaveBeenCalledWith("event_date", { ascending: true });
  });

  it("getUpcomingForLanding excludes today's finished events via the or() bound", async () => {
    vi.setSystemTime(parseEventDateTime("2026-08-12", "15:00:00")!);

    const chain = chainStub({ data: [], error: null });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.getUpcomingForLanding(client);

    expect(chain.or).toHaveBeenCalledWith(
      expect.stringMatching(/^event_date\.gt\.2026-08-12,and\(event_date\.eq\.2026-08-12,end_time\.gte\.15:00:00\)$/),
    );
  });

  it("getUpcomingForLanding reports the full upcoming total, not the limited page", async () => {
    // The landing page draws "See all events" only when the total exceeds what
    // the strip rendered, so a count of the limited rows would always hide it.
    const chain = chainStub({ data: [futureActive], count: 12, error: null });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    const result = await eventDao.getUpcomingForLanding(client);

    expect(chain.select).toHaveBeenCalledWith("*", { count: "exact" });
    expect(result.total).toBe(12);
    expect(result.events).toHaveLength(1);
  });

  it("getUpcomingForLanding reports a zero total when the query fails", async () => {
    const chain = chainStub({ data: null, count: null, error: { message: "denied", code: "42501" } });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    const result = await eventDao.getUpcomingForLanding(client);

    expect(result.events).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("getUpcomingForLanding asks for one full row of the landing grid", async () => {
    // The grid is three cards wide at lg, so the query has to supply three or
    // the row is always short.
    const chain = chainStub({ data: [], error: null });
    const client = { from: vi.fn(() => chain) } as unknown as DbClient;

    await eventDao.getUpcomingForLanding(client);

    expect(chain.limit).toHaveBeenCalledWith(3);
  });
});
