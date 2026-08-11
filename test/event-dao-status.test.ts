import { ROLES } from "@/shared/lib/roles";
import { describe, it, expect, vi } from "vitest";
import * as eventDao from "@/modules/events/db/event.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * The publish flow only ever moves an event to "active", so a past event never
 * has its status column advanced. These tests pin the read paths' compensation:
 * an active event whose end time has passed is served as complete.
 */

function chainStub(result: unknown) {
  const chain: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "gte", "lt", "order", "limit", "range", "single", "maybeSingle"]) {
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
