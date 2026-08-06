import { describe, it, expect, vi, beforeEach } from "vitest";
import * as dao from "@/shared/db/dao/course.dao";
import type { DbClient } from "@/shared/db/dao/types";

/**
 * A client whose answer depends on the table asked for, so the DAOs that read
 * several in one call can be exercised as one behaviour.
 */
function stub(byTable: Record<string, { data?: unknown; error?: unknown }>) {
  const calls: Array<[string, string, unknown[]]> = [];

  const from = vi.fn((table: string) => {
    const result = byTable[table] ?? { data: null };
    const chain: Record<string, unknown> = {
      single: async () => result,
      maybeSingle: async () => result,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve),
    };
    for (const method of ["select", "eq", "in", "neq", "order", "limit", "insert", "update", "delete"]) {
      chain[method] = (...args: unknown[]) => {
        calls.push([table, method, args]);
        return chain;
      };
    }
    return chain;
  });

  return { client: { from } as unknown as DbClient, calls, from };
}

const argsOf = (calls: Array<[string, string, unknown[]]>, table: string, method: string) =>
  calls.find(([t, m]) => t === table && m === method)?.[2];

beforeEach(() => {
  vi.clearAllMocks();
  // The write paths log the driver's message before giving up; the assertions
  // below are about the return value, not the noise.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("course.dao listCoursesWithEvents", () => {
  it("attaches each course's event and creator", async () => {
    const { client } = stub({
      COURSE: { data: [{ id: 1, event_id: 9, created_by: 3 }] },
      EVENT: { data: [{ id: 9, title: "Demo Day", event_date: "2026-09-01" }] },
      USER: { data: [{ id: 3, full_name: "Ana" }] },
    });

    const [course] = await dao.listCoursesWithEvents(client);

    expect(course).toMatchObject({ event_title: "Demo Day", event_date: "2026-09-01", creator_name: "Ana" });
  });

  it("renders a course whose event or creator is missing rather than dropping it", async () => {
    const { client } = stub({ COURSE: { data: [{ id: 1, event_id: 9, created_by: null }] }, EVENT: { data: [] } });

    const [course] = await dao.listCoursesWithEvents(client);

    expect(course).toMatchObject({ event_title: null, event_date: null, creator_name: null });
  });

  it("does not go looking for events when there are no courses", async () => {
    const { client, from } = stub({ COURSE: { data: [] } });

    await expect(dao.listCoursesWithEvents(client)).resolves.toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("answers with an empty list when the query itself returned nothing", async () => {
    const { client } = stub({ COURSE: { data: null } });

    await expect(dao.listCoursesWithEvents(client)).resolves.toEqual([]);
  });
});

describe("course.dao writes", () => {
  it("returns the created course", async () => {
    const { client } = stub({ COURSE: { data: { id: 4 }, error: null } });

    await expect(
      dao.createCourse(client, { course_name: "Intro", course_description: null, event_id: 9, created_by: 3 }),
    ).resolves.toMatchObject({ id: 4 });
  });

  it("reports a rejected insert as no course", async () => {
    const { client } = stub({ COURSE: { data: null, error: { message: "violates foreign key", code: "23503" } } });

    await expect(
      dao.createCourse(client, { course_name: "Intro", course_description: null, event_id: 9, created_by: 3 }),
    ).resolves.toBeNull();
  });

  it("defaults a new module to lessons rather than leaving its type unset", async () => {
    const { client, calls } = stub({ MODULE: { data: { id: 2 }, error: null } });

    await dao.createModule(client, { course_id: 1, module_name: "Week one", sequence_order: 1 });

    expect((argsOf(calls, "MODULE", "insert") as [Record<string, unknown>])[0]).toMatchObject({ module_type: "lessons" });
  });

  it("keeps the module type the caller asked for", async () => {
    const { client, calls } = stub({ MODULE: { data: { id: 2 }, error: null } });

    await dao.createModule(client, { course_id: 1, module_name: "Ask us", sequence_order: 2, module_type: "qa" });

    expect((argsOf(calls, "MODULE", "insert") as [Record<string, unknown>])[0]).toMatchObject({ module_type: "qa" });
  });

  it("stamps a lock change so the client can tell it moved", async () => {
    const { client, calls } = stub({ MODULE: { data: { id: 2, is_locked: true }, error: null } });

    await dao.setModuleLock(client, 2, true);

    const [payload] = argsOf(calls, "MODULE", "update") as [Record<string, unknown>];
    expect(payload).toMatchObject({ is_locked: true });
    expect(payload).toHaveProperty("updated_at");
  });

  it("reports whether each delete landed", async () => {
    const ok = stub({ COURSE: { error: null }, MODULE: { error: null }, LESSON: { error: null } });
    const blocked = stub({ COURSE: { error: { message: "still referenced" } } });

    await expect(dao.deleteCourse(ok.client, 1)).resolves.toBe(true);
    await expect(dao.deleteModule(ok.client, 2)).resolves.toBe(true);
    await expect(dao.deleteLesson(ok.client, 3)).resolves.toBe(true);
    await expect(dao.deleteCourse(blocked.client, 1)).resolves.toBe(false);
  });

  it("reports a rejected edit as no row", async () => {
    const { client } = stub({ LESSON: { data: null, error: { message: "no such lesson", code: "PGRST116" } } });

    await expect(dao.updateLesson(client, 3, { description: "x" })).resolves.toBeNull();
  });
});

describe("course.dao userHasCourseAccess", () => {
  const TICKETED = { COURSE: { data: { event_id: 9 } }, TICKET: { data: [{ id: 1 }] } };

  it("lets a ticket holder in", async () => {
    const { client } = stub(TICKETED);

    await expect(dao.userHasCourseAccess(client, 3, 1)).resolves.toBe(true);
  });

  it("ignores a cancelled ticket", async () => {
    const { client, calls } = stub({ COURSE: { data: { event_id: 9 } }, TICKET: { data: [] }, EVENT_SPEAKER: { data: [] } });

    await expect(dao.userHasCourseAccess(client, 3, 1)).resolves.toBe(false);
    expect(argsOf(calls, "TICKET", "neq")).toEqual(["status", "cancelled"]);
  });

  it("lets an assigned speaker in without a ticket", async () => {
    const { client } = stub({
      COURSE: { data: { event_id: 9 } },
      TICKET: { data: [] },
      EVENT_SPEAKER: { data: [{ event_id: 9 }] },
    });

    await expect(dao.userHasCourseAccess(client, 3, 1)).resolves.toBe(true);
  });

  it("refuses when the course teaches no event at all", async () => {
    const { client, from } = stub({ COURSE: { data: { event_id: null } } });

    await expect(dao.userHasCourseAccess(client, 3, 1)).resolves.toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
  });
});
